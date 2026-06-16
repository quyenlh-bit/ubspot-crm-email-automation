import { Router, type Request, type Response } from "express";
import { verifyHubSpotSignatureV3 } from "./verify.js";
import { runOnboardingWorkflow } from "../services/automation.service.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export const webhookRouter = Router();

/**
 * HubSpot webhook receiver.
 *
 * Mount with a RAW body parser so the signature can be verified against the
 * exact bytes HubSpot sent (see index.ts).
 */
webhookRouter.post("/hubspot", async (req: Request, res: Response) => {
  const rawBody = (req.body as Buffer)?.toString("utf8") ?? "";
  const fullUrl = `${env.PUBLIC_BASE_URL}${req.originalUrl}`;

  const valid = verifyHubSpotSignatureV3({
    method: "POST",
    url: fullUrl,
    rawBody,
    signature: req.header("X-HubSpot-Signature-V3") ?? undefined,
    timestamp: req.header("X-HubSpot-Request-Timestamp") ?? undefined,
  });

  if (!valid) {
    logger.warn("Rejected webhook with invalid signature");
    return res.status(401).json({ error: "invalid signature" });
  }

  // Respond fast (HubSpot expects 2xx within ~5s); process async.
  res.status(204).end();

  let events: Array<Record<string, unknown>> = [];
  try {
    events = JSON.parse(rawBody || "[]");
  } catch {
    logger.error("Webhook body is not valid JSON");
    return;
  }

  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (err) {
      logger.error("Failed handling webhook event", { err: String(err), event });
    }
  }
});

/** Route a single HubSpot subscription event to the right handler. */
async function handleEvent(event: Record<string, unknown>) {
  const type = String(event.subscriptionType ?? "unknown");
  logger.info("Webhook event received", { type });

  switch (type) {
    case "contact.creation": {
      const email = String(event.propertyValue ?? "");
      if (email) await runOnboardingWorkflow({ email, source: "webhook" });
      break;
    }
    default:
      logger.debug("Unhandled subscription type", { type });
  }
}
