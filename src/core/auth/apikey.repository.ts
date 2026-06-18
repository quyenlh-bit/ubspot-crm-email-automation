import { randomUUID } from "node:crypto";
import { query } from "../../db/pool.js";
import { memApiKeys, useInMemory } from "../../db/memory.js";
import type { ApiKey, ApiRole } from "../domain.js";

export interface ApiKeyRepository {
  create(tenantId: string, role: ApiRole, label: string | null): Promise<ApiKey>;
  list(tenantId: string): Promise<ApiKey[]>;
  findByKey(key: string): Promise<ApiKey | null>;
}

export const generateKey = () => `uk_${randomUUID().replace(/-/g, "")}`;

interface ApiKeyRow {
  id: string;
  tenant_id: string;
  key: string;
  role: ApiRole;
  label: string | null;
  created_at: Date;
}

const toDomain = (r: ApiKeyRow): ApiKey => ({
  id: r.id,
  tenantId: r.tenant_id,
  key: r.key,
  role: r.role,
  label: r.label,
  createdAt: r.created_at,
});

const COLS = "id, tenant_id, key, role, label, created_at";

class PostgresApiKeyRepository implements ApiKeyRepository {
  async create(tenantId: string, role: ApiRole, label: string | null): Promise<ApiKey> {
    const rows = await query<ApiKeyRow>(
      `insert into api_keys (tenant_id, key, role, label) values ($1, $2, $3, $4) returning ${COLS}`,
      [tenantId, generateKey(), role, label],
    );
    return toDomain(rows[0]);
  }
  async list(tenantId: string): Promise<ApiKey[]> {
    const rows = await query<ApiKeyRow>(
      `select ${COLS} from api_keys where tenant_id = $1 order by created_at desc`,
      [tenantId],
    );
    return rows.map(toDomain);
  }
  async findByKey(key: string): Promise<ApiKey | null> {
    const rows = await query<ApiKeyRow>(`select ${COLS} from api_keys where key = $1`, [key]);
    return rows[0] ? toDomain(rows[0]) : null;
  }
}

export const apiKeyRepository: ApiKeyRepository = useInMemory
  ? memApiKeys
  : new PostgresApiKeyRepository();
