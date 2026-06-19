import { query } from "../../db/pool.js";
import { memVouchers, useInMemory } from "../../db/memory.js";
import type { Voucher, VoucherStatus } from "../domain.js";

export type IssueVoucher = Omit<Voucher, "id" | "issuedAt" | "status" | "redeemedAt">;

interface VoucherRow {
  id: string;
  tenant_id: string;
  email: string;
  code: string;
  amount: string;
  status: VoucherStatus;
  campaign_id: string | null;
  journey_id: string | null;
  issued_at: Date;
  expires_at: Date | null;
  redeemed_at: Date | null;
}

const toDomain = (r: VoucherRow): Voucher => ({
  id: r.id,
  tenantId: r.tenant_id,
  email: r.email,
  code: r.code,
  amount: Number(r.amount),
  status: r.status,
  campaignId: r.campaign_id,
  journeyId: r.journey_id,
  issuedAt: r.issued_at,
  expiresAt: r.expires_at,
  redeemedAt: r.redeemed_at,
});

const COLS =
  "id, tenant_id, email, code, amount, status, campaign_id, journey_id, issued_at, expires_at, redeemed_at";

export async function issue(v: IssueVoucher): Promise<Voucher> {
  if (useInMemory) return memVouchers.issue(v);
  const rows = await query<VoucherRow>(
    `insert into vouchers (tenant_id, email, code, amount, campaign_id, journey_id, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7) returning ${COLS}`,
    [v.tenantId, v.email, v.code, v.amount, v.campaignId ?? null, v.journeyId ?? null, v.expiresAt],
  );
  return toDomain(rows[0]);
}

export async function list(tenantId: string): Promise<Voucher[]> {
  if (useInMemory) return memVouchers.list(tenantId);
  const rows = await query<VoucherRow>(
    `select ${COLS} from vouchers where tenant_id = $1 order by issued_at desc limit 500`,
    [tenantId],
  );
  return rows.map(toDomain);
}

export async function findById(tenantId: string, id: string): Promise<Voucher | null> {
  if (useInMemory) return memVouchers.findById(tenantId, id);
  const rows = await query<VoucherRow>(`select ${COLS} from vouchers where tenant_id = $1 and id = $2`, [tenantId, id]);
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function setStatus(tenantId: string, id: string, status: VoucherStatus): Promise<Voucher | null> {
  if (useInMemory) return memVouchers.setStatus(tenantId, id, status);
  const rows = await query<VoucherRow>(
    `update vouchers set status = $3, redeemed_at = case when $3 = 'redeemed' then now() else redeemed_at end
     where tenant_id = $1 and id = $2 returning ${COLS}`,
    [tenantId, id, status],
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function redeemedEmails(tenantId: string): Promise<string[]> {
  if (useInMemory) return memVouchers.redeemedEmails(tenantId);
  const rows = await query<{ email: string }>(
    `select distinct email from vouchers where tenant_id = $1 and status = 'redeemed'`,
    [tenantId],
  );
  return rows.map((r) => r.email);
}

export async function expireDue(tenantId: string, now: Date): Promise<number> {
  if (useInMemory) return memVouchers.expireDue(tenantId, now);
  const rows = await query<{ id: string }>(
    `update vouchers set status = 'expired' where tenant_id = $1 and status = 'issued' and expires_at <= $2 returning id`,
    [tenantId, now],
  );
  return rows.length;
}
