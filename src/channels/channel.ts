import type { ChannelConnection, ChannelProvider, Contact } from "../core/domain.js";

/**
 * CRM channel abstraction.
 *
 * A "channel" is an external CRM provider (HubSpot, Salesforce, Zoho, …) that
 * the core syncs records to and from. Each provider ships one implementation of
 * `CrmChannel`; the rest of the platform only ever talks to this interface, so
 * adding a provider never touches the core or the API layer.
 */

/** What a given provider integration is able to do. */
export type ChannelCapability =
  | "contact.push" // write a core contact out to the provider
  | "contact.pull" // read a contact back from the provider
  | "webhook"; // receive inbound change notifications

/** A normalized inbound change emitted by a provider webhook. */
export interface ChannelEvent {
  type: "contact.changed" | "unknown";
  externalId?: string;
  /** Best-effort normalized fields the provider included with the event. */
  contact?: Partial<Pick<Contact, "email" | "firstName" | "lastName" | "phone">>;
  raw: unknown;
}

/** Inputs needed to verify a provider webhook request. */
export interface WebhookRequest {
  method: string;
  url: string;
  rawBody: string;
  headers: Record<string, string | undefined>;
}

export interface CrmChannel {
  readonly provider: ChannelProvider;
  readonly capabilities: ChannelCapability[];

  /** Create/update the contact in the provider; return its external id. */
  pushContact(contact: Contact): Promise<{ externalId: string }>;

  /** Verify an inbound webhook's authenticity. */
  verifyWebhook?(req: WebhookRequest): boolean;

  /** Parse a verified webhook body into normalized events. */
  parseWebhook?(rawBody: string): ChannelEvent[];
}

/** Factory signature: build a channel from a stored tenant connection. */
export type ChannelFactory = (connection: ChannelConnection) => CrmChannel;
