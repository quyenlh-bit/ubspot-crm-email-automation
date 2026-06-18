import { campaignRepository } from "../core/campaigns/campaign.repository.js";
import { contactRepository } from "../core/contacts/contact.repository.js";
import { filterSendable } from "../core/compliance/policy.js";
import { getSegment, resolveMembers } from "./segment.service.js";
import type { Campaign, CampaignInput } from "../core/domain.js";
import { logger } from "../utils/logger.js";

/**
 * Campaign builder use cases.
 *
 * Sending is SIMULATED in v1: we resolve the audience and record how many
 * contacts the campaign would reach, but do not call a real email provider.
 * The per-recipient dispatch (HubSpot transactional / other channel) hooks in
 * where noted once credentials and a worker are in place.
 */
export const createCampaign = (tenantId: string, input: CampaignInput): Promise<Campaign> =>
  campaignRepository.create(tenantId, input);

export const listCampaigns = (tenantId: string): Promise<Campaign[]> =>
  campaignRepository.list(tenantId);

/**
 * Resolve the contacts a campaign targets. A saved segment (if set) takes
 * precedence; otherwise fall back to the lifecycle-stage filter (empty = all).
 */
async function resolveRecipients(tenantId: string, campaign: Campaign) {
  if (campaign.segmentId) {
    const segment = await getSegment(tenantId, campaign.segmentId);
    if (segment) return resolveMembers(tenantId, segment);
  }
  const contacts = await contactRepository.list(tenantId, 1000);
  const stage = campaign.audienceLifecycleStage;
  return stage ? contacts.filter((c) => c.lifecycleStage === stage) : contacts;
}

/** Send (simulated): count recipients, mark the campaign sent. */
export async function sendCampaign(tenantId: string, campaignId: string): Promise<Campaign> {
  const campaign = await campaignRepository.findById(tenantId, campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  if (campaign.status === "sent") return campaign;

  const recipients = await resolveRecipients(tenantId, campaign);
  // Compliance gate: drop suppressed / non-consenting contacts before sending.
  const { sendable, skipped } = await filterSendable(
    tenantId,
    recipients.map((c) => c.email),
    "email",
  );
  // TODO: real dispatch — for each sendable recipient, send via the tenant's
  // email channel (sendTransactionalEmail) with {{firstName}} merged. Simulated.
  logger.info("Sending campaign (simulated)", {
    tenantId,
    campaignId,
    sendable: sendable.length,
    skipped: skipped.length,
  });

  return campaignRepository.markSent(tenantId, campaignId, sendable.length);
}
