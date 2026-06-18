import { query } from "../../db/pool.js";
import { memSyncLog, useInMemory } from "../../db/memory.js";
import { logger } from "../../utils/logger.js";

/**
 * Audit trail for every core ⇄ channel sync attempt (table: sync_log).
 *
 * Writes are best-effort: a logging failure must never break the sync it is
 * recording, so {@link record} swallows its own errors (after logging them).
 */
export interface SyncLogEntry {
  tenantId: string;
  provider: string;
  direction: "outbound" | "inbound";
  entity: "contact" | "deal";
  entityId?: string | null;
  externalId?: string | null;
  status: "ok" | "error";
  detail?: string | null;
}

/** A persisted sync_log row (what the audit UI reads). */
export interface SyncLogRecord extends SyncLogEntry {
  id: string;
  createdAt: Date;
}

interface SyncLogRow {
  id: string;
  tenant_id: string;
  provider: string;
  direction: "outbound" | "inbound";
  entity: "contact" | "deal";
  entity_id: string | null;
  external_id: string | null;
  status: "ok" | "error";
  detail: string | null;
  created_at: Date;
}

const toRecord = (r: SyncLogRow): SyncLogRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  provider: r.provider,
  direction: r.direction,
  entity: r.entity,
  entityId: r.entity_id,
  externalId: r.external_id,
  status: r.status,
  detail: r.detail,
  createdAt: r.created_at,
});

/** Most recent audit entries for a tenant (newest first). */
export async function list(tenantId: string, limit = 100): Promise<SyncLogRecord[]> {
  if (useInMemory) return memSyncLog.list(tenantId, limit);
  const rows = await query<SyncLogRow>(
    `select id, tenant_id, provider, direction, entity, entity_id, external_id, status, detail, created_at
       from sync_log where tenant_id = $1 order by created_at desc limit $2`,
    [tenantId, limit],
  );
  return rows.map(toRecord);
}

export async function record(entry: SyncLogEntry): Promise<void> {
  if (useInMemory) {
    await memSyncLog.record(entry);
    return;
  }
  try {
    await query(
      `insert into sync_log
         (tenant_id, provider, direction, entity, entity_id, external_id, status, detail)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.tenantId,
        entry.provider,
        entry.direction,
        entry.entity,
        entry.entityId ?? null,
        entry.externalId ?? null,
        entry.status,
        entry.detail ?? null,
      ],
    );
  } catch (err) {
    logger.error("Failed to write sync_log entry", { err: String(err) });
  }
}
