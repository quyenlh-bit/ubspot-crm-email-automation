import * as events from "../core/events/event.repository.js";
import { campaignRepository } from "../core/campaigns/campaign.repository.js";

export interface Funnel {
  sent: number;
  open: number;
  click: number;
  conversion: number;
}

export interface AttributionRow {
  campaignId: string;
  name: string;
  conversions: number;
  revenue: number;
}

export interface Attribution {
  totalRevenue: number;
  totalConversions: number;
  campaigns: AttributionRow[];
}

/** Aggregate the email/message funnel from tracked events. */
export async function getFunnel(tenantId: string): Promise<Funnel> {
  const evts = await events.list(tenantId, 5000);
  const count = (t: string) => evts.filter((e) => e.type === t).length;
  return {
    sent: count("message.sent"),
    open: count("message.open"),
    click: count("message.click"),
    conversion: count("conversion"),
  };
}

/**
 * Attribution: tie conversion events (with their amount) back to the campaign
 * that drove them — the marketing → loyalty-revenue link that proves ROI.
 */
export async function getAttribution(tenantId: string): Promise<Attribution> {
  const evts = await events.list(tenantId, 5000);
  const conversions = evts.filter((e) => e.type === "conversion");
  const campaigns = await campaignRepository.list(tenantId, 500);
  const nameById = new Map(campaigns.map((c) => [c.id, c.name]));

  const byCampaign = new Map<string, AttributionRow>();
  let totalRevenue = 0;
  for (const e of conversions) {
    const id = e.campaignId ?? "unattributed";
    const row =
      byCampaign.get(id) ??
      { campaignId: id, name: nameById.get(id) ?? "(không gắn campaign)", conversions: 0, revenue: 0 };
    row.conversions += 1;
    row.revenue += e.amount ?? 0;
    totalRevenue += e.amount ?? 0;
    byCampaign.set(id, row);
  }

  return {
    totalRevenue,
    totalConversions: conversions.length,
    campaigns: [...byCampaign.values()].sort((a, b) => b.revenue - a.revenue),
  };
}
