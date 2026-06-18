import { getChannelForTenant } from "../channels/registry.js";
import { HubSpotChannel } from "../channels/hubspot/hubspot.channel.js";
import { logger } from "../utils/logger.js";

export interface SendEmailInput {
  /** Recipient email address. */
  to: string;
  /** Merge fields injected into the transactional email template. */
  contactProperties?: Record<string, string>;
  customProperties?: Record<string, string>;
}

/**
 * Use case 1 — Send an automated transactional email.
 *
 * Transactional email is HubSpot-specific (single-send API), so this resolves
 * the tenant's HubSpot channel and uses its exposed SDK + configured email
 * asset id. Both come from the tenant's stored connection config — there are no
 * global HubSpot credentials anymore.
 *
 * Docs: https://developers.hubspot.com/docs/api/marketing/transactional-emails
 */
export async function sendTransactionalEmail(tenantId: string, input: SendEmailInput) {
  const channel = await getChannelForTenant(tenantId, "hubspot");
  if (!(channel instanceof HubSpotChannel)) {
    throw new Error(`Tenant ${tenantId} has no enabled HubSpot connection for email.`);
  }

  const emailId = channel.transactionalEmailId;
  if (!emailId) {
    throw new Error(
      `HubSpot connection for tenant ${tenantId} has no transactionalEmailId — ` +
        "set it in the connection config to send transactional email.",
    );
  }

  logger.info("Sending transactional email", { tenantId, to: input.to });

  const result = await channel.sdk.marketing.transactional.singleSendApi.sendEmail({
    emailId: Number(emailId),
    message: { to: input.to },
    contactProperties: input.contactProperties ?? {},
    customProperties: input.customProperties ?? {},
  });

  logger.info("Transactional email queued", { tenantId, to: input.to, status: result.status });
  return result;
}
