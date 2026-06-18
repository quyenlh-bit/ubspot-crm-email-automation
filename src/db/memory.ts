import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type {
  Campaign,
  CampaignInput,
  ChannelConnection,
  ChannelProvider,
  Contact,
  ContactConsent,
  ContactInput,
  Journey,
  JourneyInput,
  JourneyRunSummary,
  MessageChannelType,
  Segment,
  SegmentInput,
  SuppressionEntry,
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

class InMemoryCampaignRepository {
  private rows: Campaign[] = [];

  async create(tenantId: string, input: CampaignInput): Promise<Campaign> {
    const now = new Date();
    const campaign: Campaign = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      templateId: input.templateId ?? null,
      subject: input.subject,
      body: input.body,
      segmentId: input.segmentId ?? null,
      audienceLifecycleStage: input.audienceLifecycleStage ?? null,
      scheduledAt: input.scheduledAt ?? null,
      status: input.scheduledAt ? "scheduled" : "draft",
      recipientCount: null,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(campaign);
    return campaign;
  }
  async list(tenantId: string, limit = 100): Promise<Campaign[]> {
    return this.rows
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  async findById(tenantId: string, id: string): Promise<Campaign | null> {
    return this.rows.find((r) => r.tenantId === tenantId && r.id === id) ?? null;
  }
  async markSent(tenantId: string, id: string, recipientCount: number): Promise<Campaign> {
    const c = this.rows.find((r) => r.tenantId === tenantId && r.id === id);
    if (!c) throw new Error(`Campaign ${id} not found for tenant ${tenantId}`);
    c.status = "sent";
    c.recipientCount = recipientCount;
    c.sentAt = new Date();
    c.updatedAt = c.sentAt;
    return c;
  }
}

const emptyChannels = (): Record<MessageChannelType, boolean> => ({ email: false, sms: false, zalo: false });

interface ConsentRow {
  tenantId: string;
  email: string;
  channel: MessageChannelType;
  optedIn: boolean;
  updatedAt: Date;
}

const consentRows: ConsentRow[] = [];
export const memConsent = {
  async setConsent(tenantId: string, email: string, channel: MessageChannelType, optedIn: boolean): Promise<void> {
    const row = consentRows.find((r) => r.tenantId === tenantId && r.email === email && r.channel === channel);
    if (row) {
      row.optedIn = optedIn;
      row.updatedAt = new Date();
    } else {
      consentRows.push({ tenantId, email, channel, optedIn, updatedAt: new Date() });
    }
  },
  async isOptedIn(tenantId: string, email: string, channel: MessageChannelType): Promise<boolean> {
    return consentRows.find((r) => r.tenantId === tenantId && r.email === email && r.channel === channel)?.optedIn ?? false;
  },
  async listConsents(tenantId: string): Promise<ContactConsent[]> {
    const byEmail = new Map<string, ContactConsent>();
    for (const r of consentRows.filter((x) => x.tenantId === tenantId)) {
      const c = byEmail.get(r.email) ?? { tenantId, email: r.email, channels: emptyChannels(), updatedAt: r.updatedAt };
      c.channels[r.channel] = r.optedIn;
      if (r.updatedAt > c.updatedAt) c.updatedAt = r.updatedAt;
      byEmail.set(r.email, c);
    }
    return [...byEmail.values()];
  },
};

const suppressionRows: SuppressionEntry[] = [];
export const memSuppression = {
  async add(tenantId: string, email: string, reason: string | null): Promise<SuppressionEntry> {
    const existing = suppressionRows.find((r) => r.tenantId === tenantId && r.email === email);
    if (existing) return existing;
    const entry: SuppressionEntry = { id: randomUUID(), tenantId, email, reason, createdAt: new Date() };
    suppressionRows.push(entry);
    return entry;
  },
  async remove(tenantId: string, email: string): Promise<void> {
    const i = suppressionRows.findIndex((r) => r.tenantId === tenantId && r.email === email);
    if (i >= 0) suppressionRows.splice(i, 1);
  },
  async list(tenantId: string): Promise<SuppressionEntry[]> {
    return suppressionRows
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },
  async has(tenantId: string, email: string): Promise<boolean> {
    return suppressionRows.some((r) => r.tenantId === tenantId && r.email === email);
  },
};

class InMemorySegmentRepository {
  private rows: Segment[] = [];
  async create(tenantId: string, input: SegmentInput): Promise<Segment> {
    const now = new Date();
    const seg: Segment = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      type: input.type,
      lifecycleStages: input.lifecycleStages ?? [],
      memberEmails: input.memberEmails ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(seg);
    return seg;
  }
  async list(tenantId: string): Promise<Segment[]> {
    return this.rows
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async findById(tenantId: string, id: string): Promise<Segment | null> {
    return this.rows.find((r) => r.tenantId === tenantId && r.id === id) ?? null;
  }
}

class InMemoryJourneyRepository {
  private rows: Journey[] = [];
  async create(tenantId: string, input: JourneyInput): Promise<Journey> {
    const now = new Date();
    const journey: Journey = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      segmentId: input.segmentId,
      steps: input.steps,
      status: "draft",
      lastRunAt: null,
      lastRunSummary: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(journey);
    return journey;
  }
  async list(tenantId: string): Promise<Journey[]> {
    return this.rows
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async findById(tenantId: string, id: string): Promise<Journey | null> {
    return this.rows.find((r) => r.tenantId === tenantId && r.id === id) ?? null;
  }
  async recordRun(tenantId: string, id: string, summary: JourneyRunSummary): Promise<Journey> {
    const j = this.rows.find((r) => r.tenantId === tenantId && r.id === id);
    if (!j) throw new Error(`Journey ${id} not found for tenant ${tenantId}`);
    j.status = "active";
    j.lastRunAt = new Date();
    j.lastRunSummary = summary;
    j.updatedAt = j.lastRunAt;
    return j;
  }
}

export const memTenants = new InMemoryTenantRepository();
export const memContacts = new InMemoryContactRepository();
export const memConnections = new InMemoryConnectionRepository();
export const memCampaigns = new InMemoryCampaignRepository();
export const memSegments = new InMemorySegmentRepository();
export const memJourneys = new InMemoryJourneyRepository();

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
  await memCampaigns.create(tenant.id, {
    name: "Welcome new leads",
    templateId: "welcome",
    subject: "Chào mừng {{firstName}} đến với UrBox!",
    body: "Xin chào {{firstName}},\n\nCảm ơn bạn đã tham gia.\n\n— Đội ngũ UrBox",
    audienceLifecycleStage: "lead",
  });

  // Demo contacts opted in to email + zalo (sms left off to show partial consent).
  for (const email of ["an.nguyen@example.com", "binh.tran@example.com", "chi.le@example.com"]) {
    await memConsent.setConsent(tenant.id, email, "email", true);
    await memConsent.setConsent(tenant.id, email, "zalo", true);
  }

  const leadSeg = await memSegments.create(tenant.id, { name: "Leads (dynamic)", type: "dynamic", lifecycleStages: ["lead"] });
  await memSegments.create(tenant.id, { name: "Khách hàng (dynamic)", type: "dynamic", lifecycleStages: ["customer"] });

  await memJourneys.create(tenant.id, {
    name: "Lead onboarding",
    segmentId: leadSeg.id,
    steps: [
      { type: "send", templateId: "welcome", channel: "email" },
      { type: "wait", waitHours: 48 },
      { type: "send", templateId: "promo", channel: "zalo" },
      { type: "exit" },
    ],
  });
}

if (useInMemory) {
  logger.warn(
    "No DATABASE_URL set — using IN-MEMORY data store. Data is NOT persisted and resets on restart.",
  );
  void seed();
}
