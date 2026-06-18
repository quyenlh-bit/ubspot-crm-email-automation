import { getMessageChannel } from "./channel.js";
import * as consent from "../core/compliance/consent.repository.js";
import * as suppression from "../core/compliance/suppression.repository.js";
import * as events from "../core/events/event.repository.js";
import type { MessageChannelType } from "../core/domain.js";

/** Max messages per contact per rolling 24h window (frequency capping). */
export const FREQUENCY_CAP_24H = 5;

export interface DeliverInput {
  tenantId: string;
  to: string;
  channel: MessageChannelType;
  subject?: string;
  body: string;
  voucherCode?: string | null;
  campaignId?: string | null;
  journeyId?: string | null;
}

export type DeliverReason = "suppressed" | "no-consent" | "frequency-capped";
export interface DeliverResult {
  to: string;
  status: "sent" | "skipped";
  reason?: DeliverReason;
}

/** Inject a voucher/offer code into the body ({{voucher}} placeholder or append). */
function injectVoucher(body: string, voucherCode?: string | null): string {
  if (!voucherCode) return body;
  if (body.includes("{{voucher}}")) return body.replaceAll("{{voucher}}", voucherCode);
  return `${body}\n\n🎁 Mã ưu đãi: ${voucherCode}`;
}

/**
 * Deliver one message through the full DELIVER pipeline:
 * compliance gate (suppression + consent) → frequency cap → voucher injection →
 * channel dispatch (simulated) → record a message.sent event.
 */
export async function deliver(input: DeliverInput): Promise<DeliverResult> {
  const { tenantId, to, channel } = input;

  if (await suppression.has(tenantId, to)) return { to, status: "skipped", reason: "suppressed" };
  if (!(await consent.isOptedIn(tenantId, to, channel))) return { to, status: "skipped", reason: "no-consent" };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await events.countRecent(tenantId, to, "message.sent", since)) >= FREQUENCY_CAP_24H) {
    return { to, status: "skipped", reason: "frequency-capped" };
  }

  const body = injectVoucher(input.body, input.voucherCode);
  await getMessageChannel(channel).send(tenantId, { to, subject: input.subject, body });
  await events.record(tenantId, {
    type: "message.sent",
    email: to,
    channel,
    campaignId: input.campaignId ?? null,
    journeyId: input.journeyId ?? null,
  });

  return { to, status: "sent" };
}
