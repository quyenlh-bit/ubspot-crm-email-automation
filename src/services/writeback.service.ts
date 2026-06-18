import { getChannelForTenant } from "../channels/registry.js";
import { HubSpotChannel } from "../channels/hubspot/hubspot.channel.js";
import { logger } from "../utils/logger.js";

/**
 * Engagement write-back: push a conversion/engagement back to the tenant's CRM
 * (HubSpot) so marketing activity is visible there. Best-effort — never throws
 * into the caller; falls back to a simulated log when no connection exists.
 */
export async function writeConversion(tenantId: string, email: string, summary: string): Promise<void> {
  try {
    const ch = await getChannelForTenant(tenantId, "hubspot");
    if (ch instanceof HubSpotChannel) {
      await ch.writeEngagement(email, summary);
      return;
    }
  } catch (err) {
    logger.warn("HubSpot write-back failed", { tenantId, email, err: String(err) });
    return;
  }
  logger.info("HubSpot write-back skipped — no connection (simulated)", { tenantId, email, summary });
}
