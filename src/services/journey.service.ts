import { journeyRepository } from "../core/journeys/journey.repository.js";
import { getSegment, resolveMembers } from "./segment.service.js";
import { deliver } from "../deliver/delivery.service.js";
import { findTemplate } from "../core/campaigns/templates.js";
import * as events from "../core/events/event.repository.js";
import * as enrollment from "../core/journeys/enrollment.repository.js";
import { contactRepository } from "../core/contacts/contact.repository.js";
import type {
  Contact,
  Journey,
  JourneyInput,
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

export const listJourneys = (tenantId: string): Promise<Journey[]> =>
  journeyRepository.list(tenantId);

/** Resolve the audience that enters a journey (trigger segment, else everyone). */
async function audienceOf(tenantId: string, journey: Journey): Promise<Contact[]> {
  const segmentId = journey.trigger?.segmentId ?? journey.segmentId;
  if (segmentId) {
    const segment = await getSegment(tenantId, segmentId);
    if (segment) return resolveMembers(tenantId, segment);
  }
  return contactRepository.list(tenantId, 1000);
}

export async function runJourney(tenantId: string, journeyId: string): Promise<Journey> {
  const journey = await journeyRepository.findById(tenantId, journeyId);
  if (!journey) throw new Error(`Journey ${journeyId} not found`);
  const members = await audienceOf(tenantId, journey);
  const summary = journey.nodes.length > 0
    ? await runGraph(tenantId, journey, members)
    : await runLinear(tenantId, journey, members);
  logger.info("Ran journey (simulated)", { tenantId, journeyId, enrolled: summary.enrolled });
  return journeyRepository.recordRun(tenantId, journeyId, summary);
}

/**
 * Journey worker step: enrol only NEW audience members (not seen before) and run
 * them through the graph once. Called on a cadence by the scheduler for active
 * journeys, so a workflow auto-runs as contacts enter its trigger segment.
 */
export async function processActiveJourney(tenantId: string, journey: Journey): Promise<number> {
  if (journey.nodes.length === 0) return 0;
  const audience = await audienceOf(tenantId, journey);
  const fresh: Contact[] = [];
  for (const m of audience) {
    if (!(await enrollment.isEnrolled(journey.id, m.email))) fresh.push(m);
  }
  if (fresh.length === 0) return 0;
  await runGraph(tenantId, journey, fresh);
  for (const m of fresh) await enrollment.enroll(journey.id, m.email);
  logger.info("Journey worker enrolled members", { tenantId, journeyId: journey.id, count: fresh.length });
  return fresh.length;
}

// ── v2 graph engine ─────────────────────────────────────────────────────────

async function runGraph(tenantId: string, journey: Journey, members: Contact[]): Promise<JourneyRunSummary> {
  // Engagement sets for condition predicates.
  const evts = await events.list(tenantId, 5000);
  const openSet = new Set(evts.filter((e) => e.type === "message.open").map((e) => e.email));
  const clickSet = new Set(evts.filter((e) => e.type === "message.click").map((e) => e.email));

  const nodeById = new Map(journey.nodes.map((n) => [n.id, n]));
  const outEdges = (id: string) => journey.edges.filter((e) => e.source === id);
  const startId = journey.edges.find((e) => e.source === "trigger")?.target ?? journey.nodes[0]?.id;
  const counts = new Map<string, number>();

  for (const member of members) {
    let currentId: string | undefined = startId;
    let hops = 0;
    while (currentId && hops < 50) {
      hops += 1;
      const node = nodeById.get(currentId);
      if (!node) break;
      counts.set(node.id, (counts.get(node.id) ?? 0) + 1);

      if (node.type === "exit") break;

      if (node.type === "send") {
        const tmpl = node.templateId ? findTemplate(node.templateId) : undefined;
        const body = (tmpl?.body ?? "").replaceAll("{{firstName}}", member.firstName ?? "bạn");
        await deliver({
          tenantId,
          to: member.email,
          channel: node.channel ?? "email",
          subject: tmpl?.subject,
          body,
          voucherCode: node.voucherCode,
          journeyId: journey.id,
        });
        currentId = outEdges(node.id)[0]?.target;
      } else if (node.type === "condition") {
        const result = evalCondition(member, node.condition ?? null, openSet, clickSet);
        const branch = result ? "yes" : "no";
        currentId = outEdges(node.id).find((e) => e.branch === branch)?.target;
      } else if (node.type === "ab_split") {
        const branch = hashPercent(member.email) < (node.splitPercent ?? 50) ? "a" : "b";
        currentId = outEdges(node.id).find((e) => e.branch === branch)?.target;
      } else {
        // wait / update_contact / webhook: count-only in a simulated run.
        currentId = outEdges(node.id)[0]?.target;
      }
    }
  }

  const steps = journey.nodes.map((n, index) => ({
    index,
    nodeId: n.id,
    type: n.type,
    detail: describeNode(n),
    count: counts.get(n.id) ?? 0,
  }));
  return { enrolled: members.length, steps };
}

function evalCondition(
  member: Contact,
  cond: WorkflowCondition | null,
  openSet: Set<string>,
  clickSet: Set<string>,
): boolean {
  if (!cond) return false;
  switch (cond.kind) {
    case "lifecycle_is":
      return (member.lifecycleStage ?? "") === (cond.value ?? "");
    case "opened":
      return openSet.has(member.email);
    case "clicked":
      return clickSet.has(member.email);
    default:
      return false;
  }
}

/** Deterministic 0–99 bucket from an email, for stable A/B assignment. */
function hashPercent(email: string): number {
  let sum = 0;
  for (const ch of email) sum += ch.charCodeAt(0);
  return sum % 100;
}

function describeNode(n: WorkflowNode): string {
  switch (n.type) {
    case "send":
      return `Gửi "${n.templateId ?? "?"}" qua ${n.channel ?? "email"}`;
    case "wait":
      return `Chờ ${n.waitHours ?? 0}h (mô phỏng)`;
    case "condition":
      return `Điều kiện: ${n.condition?.kind ?? "?"}${n.condition?.value ? ` = ${n.condition.value}` : ""}`;
    case "ab_split":
      return `A/B: ${n.splitPercent ?? 50}% A / ${100 - (n.splitPercent ?? 50)}% B`;
    case "update_contact":
      return `Cập nhật lifecycle → ${n.setLifecycleStage ?? "?"}`;
    case "webhook":
      return `Gọi webhook ${n.webhookUrl ?? ""} (mô phỏng)`;
    case "exit":
      return "Kết thúc";
    default:
      return n.type;
  }
}

// ── v1 legacy linear engine (kept for backward compatibility) ────────────────

async function runLinear(tenantId: string, journey: Journey, members: Contact[]): Promise<JourneyRunSummary> {
  const steps: JourneyRunSummary["steps"] = [];
  for (let i = 0; i < journey.steps.length; i++) {
    const step = journey.steps[i];
    if (step.type === "send") {
      const channel = step.channel ?? "email";
      const template = step.templateId ? findTemplate(step.templateId) : undefined;
      let sent = 0;
      for (const m of members) {
        const body = (template?.body ?? "").replaceAll("{{firstName}}", m.firstName ?? "bạn");
        const result = await deliver({ tenantId, to: m.email, channel, subject: template?.subject, body, journeyId: journey.id });
        if (result.status === "sent") sent += 1;
      }
      steps.push({ index: i, type: "send", detail: `Gửi "${template?.name ?? step.templateId}" qua ${channel}`, count: sent });
    } else if (step.type === "wait") {
      steps.push({ index: i, type: "wait", detail: `Chờ ${step.waitHours ?? 0}h (mô phỏng)`, count: members.length });
    } else {
      steps.push({ index: i, type: "exit", detail: "Kết thúc journey", count: members.length });
      break;
    }
  }
  return { enrolled: members.length, steps };
}
