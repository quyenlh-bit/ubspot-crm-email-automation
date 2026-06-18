import { query } from "../../db/pool.js";
import { memEvents, useInMemory } from "../../db/memory.js";
import type { EventInput, EventType, MessageEvent } from "../domain.js";

/**
 * Tracking event store (MEASURE). Records message.sent/open/click and conversion
 * events; also backs frequency capping via countRecent.
 */

interface EventRow {
  id: string;
  tenant_id: string;
  type: EventType;
  email: string;
  channel: string | null;
  campaign_id: string | null;
  journey_id: string | null;
  amount: string | null;
  created_at: Date;
}

const toDomain = (r: EventRow): MessageEvent => ({
  id: r.id,
  tenantId: r.tenant_id,
  type: r.type,
  email: r.email,
  channel: (r.channel as MessageEvent["channel"]) ?? null,
  campaignId: r.campaign_id,
  journeyId: r.journey_id,
  amount: r.amount != null ? Number(r.amount) : null,
  createdAt: r.created_at,
});

const COLS = "id, tenant_id, type, email, channel, campaign_id, journey_id, amount, created_at";

export async function record(tenantId: string, input: EventInput): Promise<MessageEvent> {
  if (useInMemory) return memEvents.record(tenantId, input);
  const rows = await query<EventRow>(
    `insert into message_events (tenant_id, type, email, channel, campaign_id, journey_id, amount)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning ${COLS}`,
    [tenantId, input.type, input.email, input.channel ?? null, input.campaignId ?? null, input.journeyId ?? null, input.amount ?? null],
  );
  return toDomain(rows[0]);
}

export async function list(tenantId: string, limit = 500): Promise<MessageEvent[]> {
  if (useInMemory) return memEvents.list(tenantId, limit);
  const rows = await query<EventRow>(
    `select ${COLS} from message_events where tenant_id = $1 order by created_at desc limit $2`,
    [tenantId, limit],
  );
  return rows.map(toDomain);
}

export async function countRecent(
  tenantId: string,
  email: string,
  type: EventType,
  since: Date,
): Promise<number> {
  if (useInMemory) return memEvents.countRecent(tenantId, email, type, since);
  const rows = await query<{ n: string }>(
    `select count(*) as n from message_events where tenant_id = $1 and email = $2 and type = $3 and created_at >= $4`,
    [tenantId, email, type, since],
  );
  return Number(rows[0]?.n ?? 0);
}
