import { tenantRepository } from "../core/tenants/tenant.repository.js";
import { campaignRepository } from "../core/campaigns/campaign.repository.js";
import { journeyRepository } from "../core/journeys/journey.repository.js";
import { sendCampaign } from "../services/campaign.service.js";
import { advanceDueRuns, enrollNewMembers } from "../services/journey.service.js";
import { logger } from "../utils/logger.js";

/**
 * In-process scheduler/worker. On each tick it dispatches any campaign whose
 * scheduledAt has passed (status still 'scheduled'). This makes the "schedule"
 * feature real without an external job runner.
 *
 * NOTE: journey wait-step advancement needs per-member enrollment state with
 * next-run timers (a larger model) — tracked as remaining Phase 2 work. The
 * journey "run now" already simulates the full flow end-to-end.
 */
const INTERVAL_MS = 10_000;
let running = false;
let handle: ReturnType<typeof setInterval> | null = null;

async function tick(): Promise<void> {
  if (running) return; // avoid overlapping ticks
  running = true;
  try {
    const now = Date.now();
    const tenants = await tenantRepository.list();
    for (const t of tenants) {
      const campaigns = await campaignRepository.list(t.id, 500);
      const due = campaigns.filter(
        (c) => c.status === "scheduled" && c.scheduledAt && new Date(c.scheduledAt).getTime() <= now,
      );
      for (const c of due) {
        try {
          logger.info("Scheduler dispatching campaign", { tenantId: t.id, campaignId: c.id });
          await sendCampaign(t.id, c.id);
        } catch (err) {
          logger.error("Scheduler dispatch failed", { campaignId: c.id, err: String(err) });
        }
      }

      // Journey worker: enrol new members into active workflows, then advance
      // every due run (active, or waiting whose wake time has passed).
      const journeys = await journeyRepository.list(t.id);
      for (const j of journeys.filter((j) => j.status === "active")) {
        try {
          await enrollNewMembers(t.id, j);
        } catch (err) {
          logger.error("Journey enroll failed", { journeyId: j.id, err: String(err) });
        }
      }
      try {
        await advanceDueRuns(t.id);
      } catch (err) {
        logger.error("Journey advance failed", { tenantId: t.id, err: String(err) });
      }
    }
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  if (handle) return;
  handle = setInterval(() => void tick(), INTERVAL_MS);
  logger.info("Scheduler started", { intervalMs: INTERVAL_MS });
}
