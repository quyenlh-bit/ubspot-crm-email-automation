import { journeyRepository } from "../core/journeys/journey.repository.js";
import { journeyRunRepository } from "../core/journeys/run.repository.js";
import { getSegment, resolveMembers } from "./segment.service.js";
import { deliver } from "../deliver/delivery.service.js";
import { findTemplate } from "../core/campaigns/templates.js";
import * as events from "../core/events/event.repository.js";
import { contactRepository } from "../core/contacts/contact.repository.js";
import type {
  Contact,
  Journey,
  JourneyInput,
  JourneyRun,
  JourneyRunSummary,
  WorkflowCondition,
  WorkflowNode,
} from "../core/domain.js";
import { logger } from "../utils/logger.js";

export const createJourney = (tenantId: string, input: JourneyInput): Promise<Journey> =>
  journeyRepository.create(tenantId, input);
export const updateJourney = (tenantId: string, id: string, input: JourneyInput): Promise<Journey> =>
  journeyRepository.update(tenantId, id, input);
export const setJourneyStatus = (tenantId: string, id: string, status: Journey["status"]): Promise<Journey> =>
  journeyRepository.setStatus(tenantId, id, status);
export const listJourneys = (tenantId: string): Promise<Journey[]> => journeyRepository.list(tenantId);

// ── Shared graph helpers ─────────────────────────────────────────────────────

const startNodeId = (j: Journey): string | null =>
  j.edges.find((e) => e.source === "trigger")?.target ?? j.nodes[0]?.id ?? null;

async function audienceOf(tenantId: string, journey: Journey): Promise<Contact[]> {
  const segmentId = journey.trigger?.segmentId ?? journey.segmentId;
  if (segmentId) {
    const segment = await getSegment(tenantId, segmentId);
    if (segment) return resolveMembers(tenantId, segment);
  }
  return contactRepository.list(tenantId, 1000);
}

function evalCondition(member: Contact, cond: WorkflowCondition | null, openSet: Set<string>, clickSet: Set<string>): boolean {
  if (!cond) return false;
  switch (cond.kind) {
    case "lifecycle_is": return (member.lifecycleStage ?? "") === (cond.value ?? "");
    case "opened": return openSet.has(member.email);
    case "clicked": return clickSet.has(member.email);
    default: return false;
  }
}

function hashPercent(email: string): number {
  let sum = 0;
  for (const ch of email) sum += ch.charCodeAt(0);
  return sum % 100;
}

function describeNode(n: WorkflowNode): string {
  switch (n.type) {
    case "send": return `Gửi "${n.templateId ?? "?"}" qua ${n.channel ?? "email"}`;
    case "wait": return `Chờ ${n.waitHours ?? 0}h`;
    case "condition": return `Điều kiện: ${n.condition?.kind ?? "?"}${n.condition?.value ? ` = ${n.condition.value}` : ""}`;
    case "ab_split": return `A/B: ${n.splitPercent ?? 50}% A / ${100 - (n.splitPercent ?? 50)}% B`;
    case "update_contact": return `Cập nhật lifecycle → ${n.setLifecycleStage ?? "?"}`;
    case "webhook": return `Gọi webhook ${n.webhookUrl ?? ""}`;
    case "exit": return "Kết thúc";
    default: return n.type;
  }
}

// ── Manual run = DRY-RUN preview (no real sends / side-effects) ──────────────

export async function runJourney(tenantId: string, journeyId: string): Promise<Journey> {
  const journey = await journeyRepository.findById(tenantId, journeyId);
  if (!journey) throw new Error(`Journey ${journeyId} not found`);
  const members = await audienceOf(tenantId, journey);
  const evts = await events.list(tenantId, 5000);
  const openSet = new Set(evts.filter((e) => e.type === "message.open").map((e) => e.email));
  const clickSet = new Set(evts.filter((e) => e.type === "message.click").map((e) => e.email));

  const nodeById = new Map(journey.nodes.map((n) => [n.id, n]));
  const outEdges = (id: string) => journey.edges.filter((e) => e.source === id);
  const counts = new Map<string, number>();

  for (const member of members) {
    let currentId: string | undefined = startNodeId(journey) ?? undefined;
    let hops = 0;
    while (currentId && hops < 50) {
      hops += 1;
      const node = nodeById.get(currentId);
      if (!node) break;
      counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
      if (node.type === "exit") break;
      if (node.type === "condition") {
        const branch = evalCondition(member, node.condition ?? null, openSet, clickSet) ? "yes" : "no";
        currentId = outEdges(node.id).find((e) => e.branch === branch)?.target;
      } else if (node.type === "ab_split") {
        const branch = hashPercent(member.email) < (node.splitPercent ?? 50) ? "a" : "b";
        currentId = outEdges(node.id).find((e) => e.branch === branch)?.target;
      } else {
        currentId = outEdges(node.id)[0]?.target;
      }
    }
  }

  const steps = journey.nodes.map((n, index) => ({ index, nodeId: n.id, type: n.type, detail: describeNode(n), count: counts.get(n.id) ?? 0 }));
  logger.info("Dry-run journey", { tenantId, journeyId, enrolled: members.length });
  return journeyRepository.recordRun(tenantId, journeyId, { enrolled: members.length, steps } satisfies JourneyRunSummary);
}

// ── Durable worker: enroll new members, advance due runs ─────────────────────

/** Create a run (at the entry node) for each audience member not yet enrolled. */
export async function enrollNewMembers(tenantId: string, journey: Journey): Promise<number> {
  if (journey.nodes.length === 0) return 0;
  const start = startNodeId(journey);
  const audience = await audienceOf(tenantId, journey);
  let enrolled = 0;
  for (const m of audience) {
    const run = await journeyRunRepository.enroll(tenantId, journey.id, m.email, start);
    if (run) enrolled += 1;
  }
  if (enrolled) logger.info("Journey enrolled new members", { tenantId, journeyId: journey.id, enrolled });
  return enrolled;
}

/** Advance every run that is due now (active, or waiting past its wake time). */
export async function advanceDueRuns(tenantId: string): Promise<number> {
  const due = await journeyRunRepository.listDue(tenantId, new Date());
  if (due.length === 0) return 0;
  const cache = new Map<string, Journey | null>();
  let advanced = 0;
  for (const run of due) {
    let journey = cache.get(run.journeyId);
    if (journey === undefined) {
      journey = await journeyRepository.findById(tenantId, run.journeyId);
      cache.set(run.journeyId, journey);
    }
    if (!journey) continue;
    await advanceRun(tenantId, journey, run);
    advanced += 1;
  }
  return advanced;
}

/**
 * Advance one member's run: execute nodes (real side-effects) until it parks at
 * a `wait` (persist wake time) or completes. Conditions are evaluated against
 * engagement current at advance time — meaningful because waits really elapse.
 */
async function advanceRun(tenantId: string, journey: Journey, run: JourneyRun): Promise<void> {
  const nodeById = new Map(journey.nodes.map((n) => [n.id, n]));
  const outEdges = (id: string) => journey.edges.filter((e) => e.source === id);
  const evts = await events.list(tenantId, 5000);
  const openSet = new Set(evts.filter((e) => e.type === "message.open").map((e) => e.email));
  const clickSet = new Set(evts.filter((e) => e.type === "message.click").map((e) => e.email));
  const contact = await contactRepository.findByEmail(tenantId, run.email);
  const member: Contact = contact ?? ({ email: run.email, lifecycleStage: null } as Contact);

  const complete = async () => { run.status = "completed"; run.currentNodeId = null; await journeyRunRepository.save(run); };

  let currentId = run.currentNodeId;
  let hops = 0;
  while (currentId && hops < 50) {
    hops += 1;
    const node = nodeById.get(currentId);
    if (!node) return complete();

    if (node.type === "wait") {
      run.status = "waiting";
      run.wakeAt = new Date(Date.now() + (node.waitHours ?? 0) * 60 * 60 * 1000);
      run.currentNodeId = outEdges(node.id)[0]?.target ?? null;
      await journeyRunRepository.save(run);
      return;
    }
    if (node.type === "exit") return complete();

    // Side-effects (REAL for active journeys).
    if (node.type === "send") {
      const tmpl = node.templateId ? findTemplate(node.templateId) : undefined;
      const body = (tmpl?.body ?? "").replaceAll("{{firstName}}", member.firstName ?? "bạn");
      await deliver({ tenantId, to: run.email, channel: node.channel ?? "email", subject: tmpl?.subject, body, voucherCode: node.voucherCode, journeyId: journey.id });
    } else if (node.type === "update_contact" && node.setLifecycleStage) {
      if (contact) await contactRepository.update(tenantId, contact.id, { lifecycleStage: node.setLifecycleStage });
    } else if (node.type === "webhook" && node.webhookUrl) {
      try {
        await fetch(node.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: run.email, journeyId: journey.id }) });
      } catch (err) {
        logger.warn("Journey webhook failed", { journeyId: journey.id, err: String(err) });
      }
    }

    // Next node.
    let next: string | undefined;
    if (node.type === "condition") {
      const branch = evalCondition(member, node.condition ?? null, openSet, clickSet) ? "yes" : "no";
      next = outEdges(node.id).find((e) => e.branch === branch)?.target;
    } else if (node.type === "ab_split") {
      const branch = hashPercent(run.email) < (node.splitPercent ?? 50) ? "a" : "b";
      next = outEdges(node.id).find((e) => e.branch === branch)?.target;
    } else {
      next = outEdges(node.id)[0]?.target;
    }
    if (!next) return complete();
    currentId = next;
  }
  return complete();
}
