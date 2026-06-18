/**
 * Core CRM domain — provider-agnostic. This is the source of truth.
 *
 * Nothing here knows about HubSpot (or any other CRM). External providers are
 * "channels" that the core syncs to/from; see src/channels.
 */

/** CRM providers the platform can connect to. HubSpot is just one of them. */
export type ChannelProvider = "hubspot" | "salesforce" | "zoho";

export const CHANNEL_PROVIDERS: ChannelProvider[] = [
  "hubspot",
  "salesforce",
  "zoho",
];

export interface Tenant {
  id: string;
  name: string;
  createdAt: Date;
}

/** Per-tenant connection to one CRM provider. `config` holds its credentials. */
export interface ChannelConnection {
  id: string;
  tenantId: string;
  provider: ChannelProvider;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
}

export interface Contact {
  id: string;
  tenantId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  lifecycleStage?: string | null;
  /** Map of provider → that provider's record id, e.g. { hubspot: "501" }. */
  externalIds: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  id: string;
  tenantId: string;
  contactId?: string | null;
  name: string;
  amount?: number | null;
  stage?: string | null;
  externalIds: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields accepted when creating/updating a contact (id/timestamps managed). */
export interface ContactInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  lifecycleStage?: string | null;
}

/** Lifecycle of an email campaign. */
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";

/**
 * An email campaign: a message sent to an audience of contacts. The audience is
 * targeted by lifecycle stage (empty/null = all contacts). `scheduledAt` holds
 * a future send time; actual dispatch is triggered via the send action.
 */
export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  /** Built-in template the content was started from (see campaigns/templates). */
  templateId?: string | null;
  subject: string;
  body: string;
  /** Optional saved segment as the audience (takes precedence over lifecycle). */
  segmentId?: string | null;
  /** Target audience: contacts with this lifecycle stage. Null/empty = everyone. */
  audienceLifecycleStage?: string | null;
  /** Delivery channel (default email). */
  channel: MessageChannelType;
  /** Optional voucher/offer code injected into the message (UrBox-specific). */
  voucherCode?: string | null;
  scheduledAt?: Date | null;
  status: CampaignStatus;
  /** Number of contacts the campaign was sent to (set once sent). */
  recipientCount?: number | null;
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields accepted when creating a campaign (id/status/timestamps managed). */
export interface CampaignInput {
  name: string;
  templateId?: string | null;
  subject: string;
  body: string;
  /** Optional: target a saved segment. Takes precedence over audienceLifecycleStage. */
  segmentId?: string | null;
  audienceLifecycleStage?: string | null;
  scheduledAt?: Date | null;
  channel?: MessageChannelType;
  voucherCode?: string | null;
}

/** A reusable audience. Static = explicit emails; dynamic = rule-evaluated live. */
export type SegmentType = "static" | "dynamic";

export interface Segment {
  id: string;
  tenantId: string;
  name: string;
  type: SegmentType;
  /** Dynamic rule: match contacts in these lifecycle stages (empty = everyone). */
  lifecycleStages: string[];
  /** Static membership: explicit contact emails. */
  memberEmails: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SegmentInput {
  name: string;
  type: SegmentType;
  lifecycleStages?: string[];
  memberEmails?: string[];
}

/** A step in a journey: send a message, wait, or exit. */
export interface JourneyStep {
  type: "send" | "wait" | "exit";
  templateId?: string | null; // send
  channel?: MessageChannelType | null; // send (default email)
  waitHours?: number | null; // wait
}

export interface JourneyRunSummary {
  enrolled: number;
  steps: { index: number; type: string; detail: string; count: number }[];
}

/**
 * A journey: enrol a segment's members, then walk ordered steps. v1 is a linear
 * send/wait/exit flow run on demand (simulated); branch/A-B/time triggers next.
 */
export interface Journey {
  id: string;
  tenantId: string;
  name: string;
  /** Trigger audience: members of this segment are enrolled. */
  segmentId: string | null;
  steps: JourneyStep[];
  status: "draft" | "active";
  lastRunAt?: Date | null;
  lastRunSummary?: JourneyRunSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JourneyInput {
  name: string;
  segmentId: string | null;
  steps: JourneyStep[];
}

/** Tracked events for analytics & attribution (MEASURE layer). */
export type EventType = "message.sent" | "message.open" | "message.click" | "conversion";

export interface MessageEvent {
  id: string;
  tenantId: string;
  type: EventType;
  email: string;
  channel?: MessageChannelType | null;
  campaignId?: string | null;
  journeyId?: string | null;
  /** Conversion value (e.g. redemption/transaction amount) — attribution. */
  amount?: number | null;
  createdAt: Date;
}

export interface EventInput {
  type: EventType;
  email: string;
  channel?: MessageChannelType | null;
  campaignId?: string | null;
  journeyId?: string | null;
  amount?: number | null;
}

/** Delivery channels a message can go out on. Zalo ZNS is mandatory for VN. */
export type MessageChannelType = "email" | "sms" | "zalo";

export const MESSAGE_CHANNELS: MessageChannelType[] = ["email", "sms", "zalo"];

/** Per-contact marketing consent, by channel (the legal gate — Decree 13). */
export interface ContactConsent {
  tenantId: string;
  email: string;
  channels: Record<MessageChannelType, boolean>;
  updatedAt: Date;
}

/** An email on the suppression list — never contactable (unsub/bounce/manual). */
export interface SuppressionEntry {
  id: string;
  tenantId: string;
  email: string;
  reason: string | null;
  createdAt: Date;
}
