import { contactRepository } from "../core/contacts/contact.repository.js";
import { connectionRepository } from "../core/channels/connection.repository.js";
import { createChannel } from "../channels/registry.js";
import * as syncLog from "../core/sync/sync-log.repository.js";
import type { Contact, ContactInput } from "../core/domain.js";
import { logger } from "../utils/logger.js";

/**
 * Use case 2 — Sync a contact.
 *
 * The core Postgres `contacts` table is the source of truth; each connected CRM
 * provider is a downstream channel. Upsert into the core, then fan the record
 * out to every enabled channel that can accept it, recording the external id it
 * was given (and an audit row) for each.
 */
export async function upsertAndSyncContact(
  tenantId: string,
  input: ContactInput,
): Promise<Contact> {
  const contact = await contactRepository.upsertByEmail(tenantId, input);
  logger.info("Contact upserted in core", { tenantId, id: contact.id, email: contact.email });

  const connections = await connectionRepository.listEnabled(tenantId);
  for (const connection of connections) {
    const channel = createChannel(connection);
    if (!channel.capabilities.includes("contact.push")) continue;

    try {
      const { externalId } = await channel.pushContact(contact);
      await contactRepository.setExternalId(tenantId, contact.id, channel.provider, externalId);
      contact.externalIds[channel.provider] = externalId;
      await syncLog.record({
        tenantId,
        provider: channel.provider,
        direction: "outbound",
        entity: "contact",
        entityId: contact.id,
        externalId,
        status: "ok",
      });
    } catch (err) {
      logger.error("Failed to push contact to channel", {
        provider: channel.provider,
        email: contact.email,
        err: String(err),
      });
      await syncLog.record({
        tenantId,
        provider: channel.provider,
        direction: "outbound",
        entity: "contact",
        entityId: contact.id,
        status: "error",
        detail: String(err),
      });
    }
  }

  return contact;
}
