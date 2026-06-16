import crypto from "node:crypto";
import { env } from "../config/env.js";

/**
 * Verifies HubSpot webhook signatures (v3).
 *
 * HubSpot signs each request with:
 *   signature = HMAC-SHA256( appSecret, method + uri + body + timestamp )
 * sent in the `X-HubSpot-Signature-V3` header, with the timestamp in
 * `X-HubSpot-Request-Timestamp`.
 *
 * Docs: https://developers.hubspot.com/docs/api/webhooks/validating-requests
 */
export function verifyHubSpotSignatureV3(params: {
  method: string;
  url: string; // full URL incl. protocol + host
  rawBody: string;
  signature?: string;
  timestamp?: string;
}): boolean {
  if (!env.HUBSPOT_APP_SECRET) return false;
  if (!params.signature || !params.timestamp) return false;

  // Reject requests older than 5 minutes (replay protection).
  const age = Date.now() - Number(params.timestamp);
  if (Number.isNaN(age) || age > 5 * 60 * 1000) return false;

  const base = params.method + params.url + params.rawBody + params.timestamp;
  const expected = crypto
    .createHmac("sha256", env.HUBSPOT_APP_SECRET)
    .update(base, "utf8")
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(params.signature),
    );
  } catch {
    return false;
  }
}
