import { journeyRepository } from "../core/journeys/journey.repository.js";
import { getSegment, resolveMembers } from "./segment.service.js";
import { filterSendable } from "../core/compliance/policy.js";
import { findTemplate } from "../core/campaigns/templates.js";
import type { Journey, JourneyInput, JourneyRunSummary } from "../core/domain.js";
import { logger } from "../utils/logger.js";

export const createJourney = (tenantId: string, input: JourneyInput): Promise<Journey> =>
  journeyRepository.create(tenantId, input);

export const listJourneys = (tenantId: string): Promise<Journey[]> =>
  journeyRepository.list(tenantId);

/**
 * Run a journey (simulated, on demand). Enrol the trigger segment's members,
 * then walk steps linearly: send steps report how many pass the compliance gate
 * for that channel; wait steps are noted; exit stops. No real dispatch/delay.
 */
export async function runJourney(tenantId: string, journeyId: string): Promise<Journey> {
  const journey = await journeyRepository.findById(tenantId, journeyId);
  if (!journey) throw new Error(`Journey ${journeyId} not found`);

  const segment = journey.segmentId ? await getSegment(tenantId, journey.segmentId) : null;
  const members = segment ? await resolveMembers(tenantId, segment) : [];
  const emails = members.map((m) => m.email);

  const steps: JourneyRunSummary["steps"] = [];
  for (let i = 0; i < journey.steps.length; i++) {
    const step = journey.steps[i];
    if (step.type === "send") {
      const channel = step.channel ?? "email";
      const { sendable } = await filterSendable(tenantId, emails, channel);
      const tmpl = step.templateId ? findTemplate(step.templateId)?.name ?? step.templateId : "(không template)";
      steps.push({ index: i, type: "send", detail: `Gửi "${tmpl}" qua ${channel}`, count: sendable.length });
    } else if (step.type === "wait") {
      steps.push({ index: i, type: "wait", detail: `Chờ ${step.waitHours ?? 0}h (mô phỏng)`, count: emails.length });
    } else {
      steps.push({ index: i, type: "exit", detail: "Kết thúc journey", count: emails.length });
      break;
    }
  }

  const summary: JourneyRunSummary = { enrolled: emails.length, steps };
  logger.info("Running journey (simulated)", { tenantId, journeyId, enrolled: emails.length });
  return journeyRepository.recordRun(tenantId, journeyId, summary);
}
