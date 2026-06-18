import { upsertAndSyncContact } from "./contact.service.js";
import { sendTransactionalEmail } from "./email.service.js";
import { logger } from "../utils/logger.js";

/**
 * Use case 3 — Automation workflow orchestration.
 *
 * This is where cross-system business rules live: chain core CRM sync + email
 * actions in response to an event (e.g. a new signup). Provider-native
 * workflows still handle marketing logic; this layer handles orchestration
 * that spans the core and one or more channels.
 *
 * Every workflow is scoped to a tenant — the unit of isolation for this SaaS.
 */
export interface OnboardingEvent {
  email: string;
  firstName?: string;
  source?: string;
}

/** Example workflow: register a new lead in the core, then send a welcome email. */
export async function runOnboardingWorkflow(tenantId: string, event: OnboardingEvent) {
  logger.info("Running onboarding workflow", { tenantId, email: event.email });

  await upsertAndSyncContact(tenantId, {
    email: event.email,
    firstName: event.firstName ?? null,
    lifecycleStage: "lead",
  });

  await sendTransactionalEmail(tenantId, {
    to: event.email,
    contactProperties: event.firstName ? { firstname: event.firstName } : {},
  });

  logger.info("Onboarding workflow complete", { tenantId, email: event.email });
}
