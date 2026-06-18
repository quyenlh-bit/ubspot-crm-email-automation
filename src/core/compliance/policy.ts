import * as consent from "./consent.repository.js";
import * as suppression from "./suppression.repository.js";
import type { MessageChannelType } from "../domain.js";

export interface SendabilityResult {
  sendable: string[];
  skipped: { email: string; reason: "suppressed" | "no-consent" }[];
}

/**
 * The compliance gate. Given candidate emails and a channel, split them into
 * those that may be contacted vs those that must be skipped (and why). An email
 * is sendable only if it is NOT suppressed AND has opted in to that channel.
 */
export async function filterSendable(
  tenantId: string,
  emails: string[],
  channel: MessageChannelType,
): Promise<SendabilityResult> {
  const result: SendabilityResult = { sendable: [], skipped: [] };
  for (const email of emails) {
    if (await suppression.has(tenantId, email)) {
      result.skipped.push({ email, reason: "suppressed" });
    } else if (!(await consent.isOptedIn(tenantId, email, channel))) {
      result.skipped.push({ email, reason: "no-consent" });
    } else {
      result.sendable.push(email);
    }
  }
  return result;
}
