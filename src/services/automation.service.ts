import { upsertContact, type ContactInput } from "./contact.service.js";
import { sendTransactionalEmail } from "./email.service.js";
import { logger } from "../utils/logger.js";

/**
 * Use case 3 — Automation workflow orchestration.
 *
 * This is where business rules live: chain CRM + email actions in response
 * to an event (e.g. a new signup). Keep HubSpot-native workflows for
 * marketing logic; use this layer for cross-system orchestration.
 */
export interface OnboardingEvent {
  email: string;
  firstname?: string;
  source?: string;
}

/** Example workflow: register a new user, then send a welcome email. */
export async function runOnboardingWorkflow(event: OnboardingEvent) {
  logger.info("Running onboarding workflow", { email: event.email });

  const contact: ContactInput = {
    email: event.email,
    firstname: event.firstname,
    lifecyclestage: "lead",
  };
  await upsertContact(contact);

  await sendTransactionalEmail({
    to: event.email,
    contactProperties: event.firstname ? { firstname: event.firstname } : {},
  });

  logger.info("Onboarding workflow complete", { email: event.email });
}
