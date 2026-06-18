import { query } from "../../db/pool.js";
import { memSuppression, useInMemory } from "../../db/memory.js";
import type { SuppressionEntry } from "../domain.js";

/**
 * Suppression list: emails that must never be contacted (unsubscribed, hard
 * bounce, or manually blocked). Checked by the delivery layer before every send.
 */

interface SuppressionRow {
  id: string;
  tenant_id: string;
  email: string;
  reason: string | null;
  created_at: Date;
}

const toDomain = (r: SuppressionRow): SuppressionEntry => ({
  id: r.id,
  tenantId: r.tenant_id,
  email: r.email,
  reason: r.reason,
  createdAt: r.created_at,
});

export async function add(tenantId: string, email: string, reason: string | null): Promise<SuppressionEntry> {
  if (useInMemory) return memSuppression.add(tenantId, email, reason);
  const rows = await query<SuppressionRow>(
    `insert into suppression_list (tenant_id, email, reason)
     values ($1, $2, $3)
     on conflict (tenant_id, email) do update set reason = excluded.reason
     returning id, tenant_id, email, reason, created_at`,
    [tenantId, email, reason],
  );
  return toDomain(rows[0]);
}

export async function remove(tenantId: string, email: string): Promise<void> {
  if (useInMemory) return memSuppression.remove(tenantId, email);
  await query(`delete from suppression_list where tenant_id = $1 and email = $2`, [tenantId, email]);
}

export async function list(tenantId: string): Promise<SuppressionEntry[]> {
  if (useInMemory) return memSuppression.list(tenantId);
  const rows = await query<SuppressionRow>(
    `select id, tenant_id, email, reason, created_at from suppression_list where tenant_id = $1 order by created_at desc`,
    [tenantId],
  );
  return rows.map(toDomain);
}

export async function has(tenantId: string, email: string): Promise<boolean> {
  if (useInMemory) return memSuppression.has(tenantId, email);
  const rows = await query<{ x: number }>(
    `select 1 as x from suppression_list where tenant_id = $1 and email = $2`,
    [tenantId, email],
  );
  return rows.length > 0;
}
