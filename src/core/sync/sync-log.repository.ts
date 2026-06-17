import { query } from "../../db/pool.js";
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

export async function record(entry: SyncLogEntry): Promise<void> {
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
