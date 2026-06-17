import { Router, type Request, type Response } from "express";
import { connectionRepository } from "../core/channels/connection.repository.js";
import { contactRepository } from "../core/contacts/contact.repository.js";
import { createChannel } from "../channels/registry.js";
import * as syncLog from "../core/sync/sync-log.repository.js";
import type { ChannelEvent } from "../channels/channel.js";
import type { ChannelConnection } from "../core/domain.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export const webhookRouter = Router();

/**
 * Provider webhook receiver.
 *
 * The URL carries the connection id so we know *which tenant's* connection sent
 * the request before we can verify it — signature verification needs that
 * connection's secret. Give each provider connection a unique webhook URL:
 *   {PUBLIC_BASE_URL}/webhooks/{provider}/{connectionId}
 *
 * Mount with a RAW body parser so signatures verify against the exact bytes the
 * provider sent (see index.ts).
 */
webhookRouter.post("/:provider/:connectionId", async (req: Request, res: Response) => {
  const provider = String(req.params.provider);
  const connectionId = String(req.params.connectionId);

  let connection: ChannelConnection | null;
  try {
    connection = await connectionRepository.findById(connectionId);
  } catch (err) {
    logger.error("Failed to load connection for webhook", { connectionId, err: String(err) });
    return res.status(500).json({ error: "internal error" });
  }

  if (!connection || !connection.enabled || connection.provider !== provider) {
    return res.status(404).json({ error: "unknown connection" });
  }

  const channel = createChannel(connection);
  const rawBody = (req.body as Buffer)?.toString("utf8") ?? "";

  const verified = channel.verifyWebhook?.({
    method: "POST",
    url: `${env.PUBLIC_BASE_URL}${req.originalUrl}`,
    rawBody,
    headers: req.headers as Record<string, string | undefined>,
  });

  if (!verified) {
    logger.warn("Rejected webhook with invalid signature", { provider, connectionId });
    return res.status(401).json({ error: "invalid signature" });
  }

  // Respond fast (providers expect 2xx within a few seconds); process async.
  res.status(204).end();

  const events = channel.parseWebhook?.(rawBody) ?? [];
  for (const event of events) {
    try {
      await handleEvent(connection, event);
    } catch (err) {
      logger.error("Failed handling webhook event", { err: String(err), event });
    }
  }
});

/** Apply one normalized inbound event to the core (inbound sync). */
async function handleEvent(connection: ChannelConnection, event: ChannelEvent) {
  if (event.type !== "contact.changed") {
    logger.debug("Unhandled webhook event", { type: event.type });
    return;
  }

  // We can only reconcile the core record when the provider gave us an email.
  // (A pull-by-externalId path can be added once channels implement contact.pull.)
  const email = event.contact?.email;
  if (!email) {
    logger.debug("contact.changed without email — skipping inbound upsert", {
      externalId: event.externalId,
    });
    return;
  }

  const contact = await contactRepository.upsertByEmail(connection.tenantId, {
    email,
    firstName: event.contact?.firstName ?? null,
    lastName: event.contact?.lastName ?? null,
    phone: event.contact?.phone ?? null,
  });
  if (event.externalId) {
    await contactRepository.setExternalId(
      connection.tenantId,
      contact.id,
      connection.provider,
      event.externalId,
    );
  }

  await syncLog.record({
    tenantId: connection.tenantId,
    provider: connection.provider,
    direction: "inbound",
    entity: "contact",
    entityId: contact.id,
    externalId: event.externalId,
    status: "ok",
  });
  logger.info("Inbound contact synced", { tenantId: connection.tenantId, id: contact.id });
}
