import { query } from "../../db/pool.js";
import { memConsent, useInMemory } from "../../db/memory.js";
import { MESSAGE_CHANNELS } from "../domain.js";
import type { ContactConsent, MessageChannelType } from "../domain.js";

/**
 * Marketing consent per (tenant, email, channel). The delivery layer must check
 * isOptedIn before sending — sending without consent is a compliance breach.
 */

interface ConsentRow {
  email: string;
  channel: MessageChannelType;
  opted_in: boolean;
  updated_at: Date;
}

export async function setConsent(
  tenantId: string,
  email: string,
  channel: MessageChannelType,
  optedIn: boolean,
): Promise<void> {
  if (useInMemory) return memConsent.setConsent(tenantId, email, channel, optedIn);
  await query(
    `insert into contact_consent (tenant_id, email, channel, opted_in)
     values ($1, $2, $3, $4)
     on conflict (tenant_id, email, channel) do update set opted_in = excluded.opted_in, updated_at = now()`,
    [tenantId, email, channel, optedIn],
  );
}

export async function isOptedIn(
  tenantId: string,
  email: string,
  channel: MessageChannelType,
): Promise<boolean> {
  if (useInMemory) return memConsent.isOptedIn(tenantId, email, channel);
  const rows = await query<{ opted_in: boolean }>(
    `select opted_in from contact_consent where tenant_id = $1 and email = $2 and channel = $3`,
    [tenantId, email, channel],
  );
  return rows[0]?.opted_in ?? false;
}

export async function listConsents(tenantId: string): Promise<ContactConsent[]> {
  if (useInMemory) return memConsent.listConsents(tenantId);
  const rows = await query<ConsentRow>(
    `select email, channel, opted_in, updated_at from contact_consent where tenant_id = $1`,
    [tenantId],
  );
  const byEmail = new Map<string, ContactConsent>();
  for (const r of rows) {
    const c =
      byEmail.get(r.email) ??
      ({
        tenantId,
        email: r.email,
        channels: Object.fromEntries(MESSAGE_CHANNELS.map((ch) => [ch, false])) as Record<MessageChannelType, boolean>,
        updatedAt: r.updated_at,
      } satisfies ContactConsent);
    c.channels[r.channel] = r.opted_in;
    if (r.updated_at > c.updatedAt) c.updatedAt = r.updated_at;
    byEmail.set(r.email, c);
  }
  return [...byEmail.values()];
}
