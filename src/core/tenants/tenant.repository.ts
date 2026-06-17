import { query } from "../../db/pool.js";
import type { Tenant } from "../domain.js";

interface TenantRow {
  id: string;
  name: string;
  created_at: Date;
}

const toDomain = (r: TenantRow): Tenant => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at,
});

export class PostgresTenantRepository {
  async create(name: string): Promise<Tenant> {
    const rows = await query<TenantRow>(
      `insert into tenants (name) values ($1) returning id, name, created_at`,
      [name],
    );
    return toDomain(rows[0]);
  }

  async findById(id: string): Promise<Tenant | null> {
    const rows = await query<TenantRow>(
      `select id, name, created_at from tenants where id = $1`,
      [id],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async list(): Promise<Tenant[]> {
    const rows = await query<TenantRow>(
      `select id, name, created_at from tenants order by created_at desc`,
    );
    return rows.map(toDomain);
  }
}

export const tenantRepository = new PostgresTenantRepository();
