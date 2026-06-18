import type {
  Campaign,
  CampaignInput,
  ChannelConnection,
  Contact,
  ContactConsent,
  EmailTemplate,
  Journey,
  JourneyInput,
  MessageChannel,
  Provider,
  Segment,
  SegmentInput,
  Stats,
  SuppressionEntry,
  SyncLogRecord,
  Tenant,
} from "./types";

const BASE = "/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** Turn the backend's { error } payload (string or zod fieldErrors) into a message. */
function messageFrom(status: number, body: unknown): string {
  const err = (body as { error?: unknown } | null)?.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const parts = Object.entries(err as Record<string, unknown>).map(
      ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`,
    );
    if (parts.length) return parts.join(" · ");
  }
  return `Request failed (${status})`;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, messageFrom(res.status, body));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Meta
export const getProviders = () => http<Provider[]>("/providers");
export const getTemplates = () => http<EmailTemplate[]>("/templates");
export const getStats = (tenantId: string) => http<Stats>(`/tenants/${tenantId}/stats`);

// Tenants
export const listTenants = () => http<Tenant[]>("/tenants");
export const createTenant = (name: string) =>
  http<Tenant>("/tenants", { method: "POST", body: JSON.stringify({ name }) });

// Connections
export const listConnections = (tenantId: string) =>
  http<ChannelConnection[]>(`/tenants/${tenantId}/connections`);
export const upsertConnection = (
  tenantId: string,
  provider: string,
  config: Record<string, unknown>,
) =>
  http<ChannelConnection>(`/tenants/${tenantId}/connections`, {
    method: "POST",
    body: JSON.stringify({ provider, config }),
  });

// Contacts
export const listContacts = (tenantId: string) =>
  http<Contact[]>(`/tenants/${tenantId}/contacts`);
export const createContact = (tenantId: string, input: Partial<Contact>) =>
  http<Contact>(`/tenants/${tenantId}/contacts`, {
    method: "POST",
    body: JSON.stringify(input),
  });

// Sync log
export const listSyncLog = (tenantId: string) =>
  http<SyncLogRecord[]>(`/tenants/${tenantId}/sync-log`);

// Segments
export const listSegments = (tenantId: string) =>
  http<Segment[]>(`/tenants/${tenantId}/segments`);
export const createSegment = (tenantId: string, input: SegmentInput) =>
  http<Segment>(`/tenants/${tenantId}/segments`, { method: "POST", body: JSON.stringify(input) });

// Journeys
export const listJourneys = (tenantId: string) =>
  http<Journey[]>(`/tenants/${tenantId}/journeys`);
export const createJourney = (tenantId: string, input: JourneyInput) =>
  http<Journey>(`/tenants/${tenantId}/journeys`, { method: "POST", body: JSON.stringify(input) });
export const runJourney = (tenantId: string, journeyId: string) =>
  http<Journey>(`/tenants/${tenantId}/journeys/${journeyId}/run`, { method: "POST" });

// Campaigns
export const listCampaigns = (tenantId: string) =>
  http<Campaign[]>(`/tenants/${tenantId}/campaigns`);
export const createCampaign = (tenantId: string, input: CampaignInput) =>
  http<Campaign>(`/tenants/${tenantId}/campaigns`, {
    method: "POST",
    body: JSON.stringify(input),
  });
export const sendCampaign = (tenantId: string, campaignId: string) =>
  http<Campaign>(`/tenants/${tenantId}/campaigns/${campaignId}/send`, { method: "POST" });

// Compliance — consent & suppression
export const listConsents = (tenantId: string) =>
  http<ContactConsent[]>(`/tenants/${tenantId}/consent`);
export const setConsent = (tenantId: string, email: string, channel: MessageChannel, optedIn: boolean) =>
  http<{ ok: boolean }>(`/tenants/${tenantId}/consent`, {
    method: "PUT",
    body: JSON.stringify({ email, channel, optedIn }),
  });
export const listSuppression = (tenantId: string) =>
  http<SuppressionEntry[]>(`/tenants/${tenantId}/suppression`);
export const addSuppression = (tenantId: string, email: string, reason?: string) =>
  http<SuppressionEntry>(`/tenants/${tenantId}/suppression`, {
    method: "POST",
    body: JSON.stringify({ email, reason }),
  });
export const removeSuppression = (tenantId: string, email: string) =>
  http<{ ok: boolean }>(`/tenants/${tenantId}/suppression/remove`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });

// Workflows
export const triggerOnboarding = (
  tenantId: string,
  input: { email: string; firstName?: string },
) =>
  http<{ ok: boolean }>(`/tenants/${tenantId}/workflows/onboarding`, {
    method: "POST",
    body: JSON.stringify(input),
  });
