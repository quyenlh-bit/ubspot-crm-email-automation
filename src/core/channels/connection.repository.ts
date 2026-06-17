import { query } from "../../db/pool.js";
import type { ChannelConnection, ChannelProvider } from "../domain.js";

interface ConnectionRow {
  id: string;
  tenant_id: string;
  provider: ChannelProvider;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: Date;
}

const toDomain = (r: ConnectionRow): ChannelConnection => ({
  id: r.id,
  tenantId: r.tenant_id,
  provider: r.provider,
  config: r.config ?? {},
  enabled: r.enabled,
  createdAt: r.created_at,
});

const COLS = "id, tenant_id, provider, config, enabled, created_at";

export class PostgresConnectionRepository {
  /** Connect (or reconfigure) a provider for a tenant. */
  async upsert(
    tenantId: string,
    provider: ChannelProvider,
    config: Record<string, unknown>,
  ): Promise<ChannelConnection> {
    const rows = await query<ConnectionRow>(
      `insert into channel_connections (tenant_id, provider, config)
       values ($1, $2, $3)
       on conflict (tenant_id, provider) do update set
         config = excluded.config, enabled = true
       returning ${COLS}`,
      [tenantId, provider, JSON.stringify(config)],
    );
    return toDomain(rows[0]);
  }

  /** All enabled connections for a tenant. */
  async listEnabled(tenantId: string): Promise<ChannelConnection[]> {
    const rows = await query<ConnectionRow>(
      `select ${COLS} from channel_connections where tenant_id = $1 and enabled = true`,
      [tenantId],
    );
    return rows.map(toDomain);
  }

  async list(tenantId: string): Promise<ChannelConnection[]> {
    const rows = await query<ConnectionRow>(
      `select ${COLS} from channel_connections where tenant_id = $1`,
      [tenantId],
    );
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<ChannelConnection | null> {
    const rows = await query<ConnectionRow>(
      `select ${COLS} from channel_connections where id = $1`,
      [id],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }
}

export const connectionRepository = new PostgresConnectionRepository();
