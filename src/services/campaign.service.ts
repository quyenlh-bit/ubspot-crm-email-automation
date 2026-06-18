import { campaignRepository } from "../core/campaigns/campaign.repository.js";
import { contactRepository } from "../core/contacts/contact.repository.js";
import { deliver } from "../deliver/delivery.service.js";
import * as events from "../core/events/event.repository.js";
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
  // Deliver to each recipient through the DELIVER pipeline (gate + frequency cap
  // + voucher injection + simulated dispatch + sent-event tracking).
  let sent = 0;
  for (const c of recipients) {
    const body = campaign.body.replaceAll("{{firstName}}", c.firstName ?? "bạn");
    const result = await deliver({
      tenantId,
      to: c.email,
      channel: campaign.channel,
      subject: campaign.subject,
      body,
      voucherCode: campaign.voucherCode,
      campaignId: campaign.id,
    });
    if (result.status === "sent") sent += 1;
  }
  logger.info("Campaign delivered (simulated)", { tenantId, campaignId, sent, of: recipients.length });

  return campaignRepository.markSent(tenantId, campaignId, sent);
}

/**
 * DEV/demo helper: simulate downstream engagement for a campaign by recording
 * open/click/conversion events for a fraction of its audience, so the MEASURE
 * funnel and attribution have data without a live tracking pixel. Conversions
 * carry a synthetic redemption amount (VND) attributed to this campaign.
 */
export async function simulateEngagement(
  tenantId: string,
  campaignId: string,
): Promise<{ open: number; click: number; conversion: number }> {
  const campaign = await campaignRepository.findById(tenantId, campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const recipients = await resolveRecipients(tenantId, campaign);
  const n = recipients.length;
  const opens = Math.ceil(n * 0.7);
  const clicks = Math.ceil(n * 0.35);
  const conversions = Math.ceil(n * 0.15);
  let open = 0;
  let click = 0;
  let conversion = 0;

  for (let i = 0; i < n; i++) {
    const email = recipients[i].email;
    const base = { email, channel: campaign.channel, campaignId };
    if (i < opens) {
      await events.record(tenantId, { type: "message.open", ...base });
      open += 1;
    }
    if (i < clicks) {
      await events.record(tenantId, { type: "message.click", ...base });
      click += 1;
    }
    if (i < conversions) {
      await events.record(tenantId, { type: "conversion", ...base, amount: 200_000 + i * 50_000 });
      conversion += 1;
    }
  }

  logger.info("Simulated engagement", { tenantId, campaignId, open, click, conversion });
  return { open, click, conversion };
}
