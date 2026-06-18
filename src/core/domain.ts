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
  /** Target audience: contacts with this lifecycle stage. Null/empty = everyone. */
  audienceLifecycleStage?: string | null;
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
  audienceLifecycleStage?: string | null;
  scheduledAt?: Date | null;
}
