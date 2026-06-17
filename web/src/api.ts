import type {
  ChannelConnection,
  Contact,
  Provider,
  Stats,
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

// Workflows
export const triggerOnboarding = (
  tenantId: string,
  input: { email: string; firstName?: string },
) =>
  http<{ ok: boolean }>(`/tenants/${tenantId}/workflows/onboarding`, {
    method: "POST",
    body: JSON.stringify(input),
  });
