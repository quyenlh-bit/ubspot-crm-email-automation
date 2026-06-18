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
  audienceLifecycleStage?: string | null;
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
