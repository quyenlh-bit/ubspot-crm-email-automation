import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type {
  ChannelConnection,
  ChannelProvider,
  Contact,
  ContactInput,
  Tenant,
} from "../core/domain.js";
import type { ContactRepository } from "../core/contacts/contact.repository.js";
import type { SyncLogEntry, SyncLogRecord } from "../core/sync/sync-log.repository.js";

/**
 * In-memory data backend used when DATABASE_URL is unset. Lets the whole admin
 * UI be explored without a Postgres/Supabase instance. Data lives in plain
 * arrays and is LOST on restart — this is for demos/local UI work only, never
 * production.
 */
export const useInMemory = !env.DATABASE_URL;

/** Keep only the non-null fields of an update (mirrors SQL `coalesce`). */
const coalesce = <T>(next: T | null | undefined, prev: T | null): T | null =>
  next === null || next === undefined ? prev : next;

class InMemoryTenantRepository {
  private rows: Tenant[] = [];

  async create(name: string): Promise<Tenant> {
    const tenant: Tenant = { id: randomUUID(), name, createdAt: new Date() };
    this.rows.push(tenant);
    return tenant;
  }
  async findById(id: string): Promise<Tenant | null> {
    return this.rows.find((t) => t.id === id) ?? null;
  }
  async list(): Promise<Tenant[]> {
    return [...this.rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

class InMemoryContactRepository implements ContactRepository {
  private rows: Contact[] = [];

  async create(tenantId: string, input: ContactInput): Promise<Contact> {
    const now = new Date();
    const contact: Contact = {
      id: randomUUID(),
      tenantId,
      email: input.email,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
      lifecycleStage: input.lifecycleStage ?? null,
      externalIds: {},
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(contact);
    return contact;
  }

  async update(tenantId: string, id: string, input: Partial<ContactInput>): Promise<Contact> {
    const c = this.rows.find((r) => r.tenantId === tenantId && r.id === id);
    if (!c) throw new Error(`Contact ${id} not found for tenant ${tenantId}`);
    c.email = coalesce(input.email, c.email) ?? c.email;
    c.firstName = coalesce(input.firstName, c.firstName ?? null);
    c.lastName = coalesce(input.lastName, c.lastName ?? null);
    c.phone = coalesce(input.phone, c.phone ?? null);
    c.lifecycleStage = coalesce(input.lifecycleStage, c.lifecycleStage ?? null);
    c.updatedAt = new Date();
    return c;
  }

  async upsertByEmail(tenantId: string, input: ContactInput): Promise<Contact> {
    const existing = this.rows.find((r) => r.tenantId === tenantId && r.email === input.email);
    if (!existing) return this.create(tenantId, input);
    existing.firstName = coalesce(input.firstName, existing.firstName ?? null);
    existing.lastName = coalesce(input.lastName, existing.lastName ?? null);
    existing.phone = coalesce(input.phone, existing.phone ?? null);
    existing.lifecycleStage = coalesce(input.lifecycleStage, existing.lifecycleStage ?? null);
    existing.updatedAt = new Date();
    return existing;
  }

  async findById(tenantId: string, id: string): Promise<Contact | null> {
    return this.rows.find((r) => r.tenantId === tenantId && r.id === id) ?? null;
  }
  async findByEmail(tenantId: string, email: string): Promise<Contact | null> {
    return this.rows.find((r) => r.tenantId === tenantId && r.email === email) ?? null;
  }
  async list(tenantId: string, limit = 100): Promise<Contact[]> {
    return this.rows
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  async setExternalId(
    tenantId: string,
    id: string,
    provider: string,
    externalId: string,
  ): Promise<void> {
    const c = this.rows.find((r) => r.tenantId === tenantId && r.id === id);
    if (c) {
      c.externalIds = { ...c.externalIds, [provider]: externalId };
      c.updatedAt = new Date();
    }
  }
}

class InMemoryConnectionRepository {
  private rows: ChannelConnection[] = [];

  async upsert(
    tenantId: string,
    provider: ChannelProvider,
    config: Record<string, unknown>,
  ): Promise<ChannelConnection> {
    const existing = this.rows.find((r) => r.tenantId === tenantId && r.provider === provider);
    if (existing) {
      existing.config = config;
      existing.enabled = true;
      return existing;
    }
    const conn: ChannelConnection = {
      id: randomUUID(),
      tenantId,
      provider,
      config,
      enabled: true,
      createdAt: new Date(),
    };
    this.rows.push(conn);
    return conn;
  }
  async listEnabled(tenantId: string): Promise<ChannelConnection[]> {
    return this.rows.filter((r) => r.tenantId === tenantId && r.enabled);
  }
  async list(tenantId: string): Promise<ChannelConnection[]> {
    return this.rows.filter((r) => r.tenantId === tenantId);
  }
  async findById(id: string): Promise<ChannelConnection | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }
}

const syncLogRows: SyncLogRecord[] = [];
export const memSyncLog = {
  async record(entry: SyncLogEntry): Promise<void> {
    syncLogRows.push({ ...entry, id: randomUUID(), createdAt: new Date() });
  },
  async list(tenantId: string, limit = 100): Promise<SyncLogRecord[]> {
    return syncLogRows
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  },
};

export const memTenants = new InMemoryTenantRepository();
export const memContacts = new InMemoryContactRepository();
export const memConnections = new InMemoryConnectionRepository();

/** Pre-populate demo data so the UI isn't empty on first load. */
async function seed() {
  const tenant = await memTenants.create("Demo Tenant (in-memory)");
  await memContacts.upsertByEmail(tenant.id, {
    email: "an.nguyen@example.com",
    firstName: "An",
    lastName: "Nguyen",
    lifecycleStage: "lead",
  });
  await memContacts.upsertByEmail(tenant.id, {
    email: "binh.tran@example.com",
    firstName: "Binh",
    lastName: "Tran",
    lifecycleStage: "customer",
  });
  await memContacts.upsertByEmail(tenant.id, {
    email: "chi.le@example.com",
    firstName: "Chi",
    lastName: "Le",
    lifecycleStage: "subscriber",
  });
}

if (useInMemory) {
  logger.warn(
    "No DATABASE_URL set — using IN-MEMORY data store. Data is NOT persisted and resets on restart.",
  );
  void seed();
}
