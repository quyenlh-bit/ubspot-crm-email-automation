import * as vouchers from "../core/vouchers/voucher.repository.js";
import * as eventRepo from "../core/events/event.repository.js";
import { writeConversion } from "./writeback.service.js";
import type { Voucher } from "../core/domain.js";
import { logger } from "../utils/logger.js";

export const listVouchers = (tenantId: string): Promise<Voucher[]> => vouchers.list(tenantId);

/**
 * Redeem a voucher → the moment that closes the loyalty loop. Marks it redeemed
 * and records a `conversion` event with the voucher's value, which feeds
 * attribution (revenue → campaign/journey), journey goals (exit-as-converted),
 * and the HubSpot write-back.
 */
export async function redeemVoucher(tenantId: string, voucherId: string): Promise<Voucher> {
  const v = await vouchers.findById(tenantId, voucherId);
  if (!v) throw new Error(`Voucher ${voucherId} not found`);
  if (v.status !== "issued") return v;

  const updated = (await vouchers.setStatus(tenantId, voucherId, "redeemed")) ?? v;
  await eventRepo.record(tenantId, {
    type: "conversion",
    email: v.email,
    amount: v.amount,
    campaignId: v.campaignId ?? null,
    journeyId: v.journeyId ?? null,
  });
  await writeConversion(tenantId, v.email, `Redeem voucher ${v.code} (${v.amount}đ)`);
  logger.info("Voucher redeemed", { tenantId, voucherId, email: v.email, amount: v.amount });
  return updated;
}
