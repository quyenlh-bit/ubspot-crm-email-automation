import { hubspot } from "../hubspot/client.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export interface SendEmailInput {
  /** Recipient email address. */
  to: string;
  /** Merge fields injected into the transactional email template. */
  contactProperties?: Record<string, string>;
  customProperties?: Record<string, string>;
}

/**
 * Use case 1 — Send an automated transactional email via HubSpot's
 * single-send API. Requires HUBSPOT_TRANSACTIONAL_EMAIL_ID to point at a
 * transactional email asset created in HubSpot.
 *
 * Docs: https://developers.hubspot.com/docs/api/marketing/transactional-emails
 */
export async function sendTransactionalEmail(input: SendEmailInput) {
  if (!env.HUBSPOT_TRANSACTIONAL_EMAIL_ID) {
    throw new Error(
      "HUBSPOT_TRANSACTIONAL_EMAIL_ID is not set — cannot send transactional email.",
    );
  }

  logger.info("Sending transactional email", { to: input.to });

  const result = await hubspot.marketing.transactional.singleSendApi.sendEmail({
    emailId: Number(env.HUBSPOT_TRANSACTIONAL_EMAIL_ID),
    message: { to: input.to },
    contactProperties: input.contactProperties ?? {},
    customProperties: input.customProperties ?? {},
  });

  logger.info("Transactional email queued", {
    to: input.to,
    status: result.status,
  });
  return result;
}
