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
