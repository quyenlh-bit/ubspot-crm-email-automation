export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
}

export interface ChannelConnection {
  id: string;
  tenantId: string;
  provider: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface Contact {
  id: string;
  tenantId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  lifecycleStage?: string | null;
  externalIds: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface SyncLogRecord {
  id: string;
  tenantId: string;
  provider: string;
  direction: "outbound" | "inbound";
  entity: string;
  entityId?: string | null;
  externalId?: string | null;
  status: "ok" | "error";
  detail?: string | null;
  createdAt: string;
}

export interface Stats {
  tenants: number;
  contacts: number;
  connections: number;
  syncErrors: number;
}

export interface Provider {
  id: string;
  supported: boolean;
}

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  templateId?: string | null;
  subject: string;
  body: string;
  segmentId?: string | null;
  audienceLifecycleStage?: string | null;
  channel?: MessageChannel;
  voucherCode?: string | null;
  scheduledAt?: string | null;
  status: CampaignStatus;
  recipientCount?: number | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface CampaignInput {
  name: string;
  templateId?: string;
  subject: string;
  body: string;
  segmentId?: string;
  audienceLifecycleStage?: string;
  channel?: MessageChannel;
  voucherCode?: string;
  scheduledAt?: string;
}

export type SegmentType = "static" | "dynamic";

export interface Segment {
  id: string;
  tenantId: string;
  name: string;
  type: SegmentType;
  lifecycleStages: string[];
  memberEmails: string[];
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentInput {
  name: string;
  type: SegmentType;
  lifecycleStages?: string[];
  memberEmails?: string[];
}

export interface JourneyStep {
  type: "send" | "wait" | "exit";
  templateId?: string | null;
  channel?: "email" | "sms" | "zalo" | null;
  waitHours?: number | null;
}

export interface JourneyRunSummary {
  enrolled: number;
  steps: { index: number; type: string; detail: string; count: number }[];
}

export interface Journey {
  id: string;
  tenantId: string;
  name: string;
  segmentId: string | null;
  steps: JourneyStep[];
  status: "draft" | "active";
  lastRunAt?: string | null;
  lastRunSummary?: JourneyRunSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyInput {
  name: string;
  segmentId: string | null;
  steps: JourneyStep[];
}

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

export interface Analytics {
  funnel: Funnel;
  attribution: Attribution;
}

export type MessageChannel = "email" | "sms" | "zalo";

export interface ContactConsent {
  tenantId: string;
  email: string;
  channels: Record<MessageChannel, boolean>;
  updatedAt: string;
}

export interface SuppressionEntry {
  id: string;
  tenantId: string;
  email: string;
  reason?: string | null;
  createdAt: string;
}
