import { query } from "../../db/pool.js";
import { memContacts, useInMemory } from "../../db/memory.js";
import type { Contact, ContactInput } from "../domain.js";

/**
 * Repository interface — the core depends on this abstraction, not on Postgres.
 * Swap the implementation (e.g. for tests) without touching services.
 */
export interface ContactRepository {
  create(tenantId: string, input: ContactInput): Promise<Contact>;
  update(tenantId: string, id: string, input: Partial<ContactInput>): Promise<Contact>;
  /** Insert or update by (tenant, email). */
  upsertByEmail(tenantId: string, input: ContactInput): Promise<Contact>;
  findById(tenantId: string, id: string): Promise<Contact | null>;
  findByEmail(tenantId: string, email: string): Promise<Contact | null>;
  list(tenantId: string, limit?: number): Promise<Contact[]>;
  /** Record the id this contact has in an external provider. */
  setExternalId(tenantId: string, id: string, provider: string, externalId: string): Promise<void>;
  /** Remove a contact (used by identity-resolution merge). */
  delete(tenantId: string, id: string): Promise<void>;
}

interface ContactRow {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  lifecycle_stage: string | null;
  external_ids: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

function toDomain(r: ContactRow): Contact {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    lifecycleStage: r.lifecycle_stage,
    externalIds: r.external_ids ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const COLS =
  "id, tenant_id, email, first_name, last_name, phone, lifecycle_stage, external_ids, created_at, updated_at";

export class PostgresContactRepository implements ContactRepository {
  async create(tenantId: string, input: ContactInput): Promise<Contact> {
    const rows = await query<ContactRow>(
      `insert into contacts (tenant_id, email, first_name, last_name, phone, lifecycle_stage)
       values ($1, $2, $3, $4, $5, $6)
       returning ${COLS}`,
      [
        tenantId,
        input.email,
        input.firstName ?? null,
        input.lastName ?? null,
        input.phone ?? null,
        input.lifecycleStage ?? null,
      ],
    );
    return toDomain(rows[0]);
  }

  async update(tenantId: string, id: string, input: Partial<ContactInput>): Promise<Contact> {
    const rows = await query<ContactRow>(
      `update contacts set
         email = coalesce($3, email),
         first_name = coalesce($4, first_name),
         last_name = coalesce($5, last_name),
         phone = coalesce($6, phone),
         lifecycle_stage = coalesce($7, lifecycle_stage),
         updated_at = now()
       where tenant_id = $1 and id = $2
       returning ${COLS}`,
      [
        tenantId,
        id,
        input.email ?? null,
        input.firstName ?? null,
        input.lastName ?? null,
        input.phone ?? null,
        input.lifecycleStage ?? null,
      ],
    );
    if (!rows[0]) throw new Error(`Contact ${id} not found for tenant ${tenantId}`);
    return toDomain(rows[0]);
  }

  async upsertByEmail(tenantId: string, input: ContactInput): Promise<Contact> {
    const rows = await query<ContactRow>(
      `insert into contacts (tenant_id, email, first_name, last_name, phone, lifecycle_stage)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (tenant_id, email) do update set
         first_name = coalesce(excluded.first_name, contacts.first_name),
         last_name = coalesce(excluded.last_name, contacts.last_name),
         phone = coalesce(excluded.phone, contacts.phone),
         lifecycle_stage = coalesce(excluded.lifecycle_stage, contacts.lifecycle_stage),
         updated_at = now()
       returning ${COLS}`,
      [
        tenantId,
        input.email,
        input.firstName ?? null,
        input.lastName ?? null,
        input.phone ?? null,
        input.lifecycleStage ?? null,
      ],
    );
    return toDomain(rows[0]);
  }

  async findById(tenantId: string, id: string): Promise<Contact | null> {
    const rows = await query<ContactRow>(
      `select ${COLS} from contacts where tenant_id = $1 and id = $2`,
      [tenantId, id],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<Contact | null> {
    const rows = await query<ContactRow>(
      `select ${COLS} from contacts where tenant_id = $1 and email = $2`,
      [tenantId, email],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async list(tenantId: string, limit = 100): Promise<Contact[]> {
    const rows = await query<ContactRow>(
      `select ${COLS} from contacts where tenant_id = $1 order by created_at desc limit $2`,
      [tenantId, limit],
    );
    return rows.map(toDomain);
  }

  async setExternalId(
    tenantId: string,
    id: string,
    provider: string,
    externalId: string,
  ): Promise<void> {
    await query(
      `update contacts
         set external_ids = jsonb_set(external_ids, $3, to_jsonb($4::text), true),
             updated_at = now()
       where tenant_id = $1 and id = $2`,
      [tenantId, id, `{${provider}}`, externalId],
    );
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await query(`delete from contacts where tenant_id = $1 and id = $2`, [tenantId, id]);
  }
}

/** Default repository instance used by services. */
export const contactRepository: ContactRepository = useInMemory
  ? memContacts
  : new PostgresContactRepository();
