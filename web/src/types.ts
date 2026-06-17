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
