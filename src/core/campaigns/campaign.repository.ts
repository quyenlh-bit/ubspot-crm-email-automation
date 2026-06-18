import { query } from "../../db/pool.js";
import { memCampaigns, useInMemory } from "../../db/memory.js";
import type { Campaign, CampaignInput } from "../domain.js";

/**
 * Campaign persistence. The core depends on this interface; the Postgres and
 * in-memory implementations are selected at the bottom of the file.
 */
export interface CampaignRepository {
  create(tenantId: string, input: CampaignInput): Promise<Campaign>;
  list(tenantId: string, limit?: number): Promise<Campaign[]>;
  findById(tenantId: string, id: string): Promise<Campaign | null>;
  /** Mark a campaign sent to `recipientCount` contacts (simulated dispatch). */
  markSent(tenantId: string, id: string, recipientCount: number): Promise<Campaign>;
}

/** Initial status: scheduled if a future send time is set, else draft. */
export const initialStatus = (input: CampaignInput): Campaign["status"] =>
  input.scheduledAt ? "scheduled" : "draft";

interface CampaignRow {
  id: string;
  tenant_id: string;
  name: string;
  template_id: string | null;
  subject: string;
  body: string;
  audience_lifecycle_stage: string | null;
  scheduled_at: Date | null;
  status: Campaign["status"];
  recipient_count: number | null;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const toDomain = (r: CampaignRow): Campaign => ({
  id: r.id,
  tenantId: r.tenant_id,
  name: r.name,
  templateId: r.template_id,
  subject: r.subject,
  body: r.body,
  audienceLifecycleStage: r.audience_lifecycle_stage,
  scheduledAt: r.scheduled_at,
  status: r.status,
  recipientCount: r.recipient_count,
  sentAt: r.sent_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const COLS =
  "id, tenant_id, name, template_id, subject, body, audience_lifecycle_stage, scheduled_at, status, recipient_count, sent_at, created_at, updated_at";

class PostgresCampaignRepository implements CampaignRepository {
  async create(tenantId: string, input: CampaignInput): Promise<Campaign> {
    const rows = await query<CampaignRow>(
      `insert into campaigns
         (tenant_id, name, template_id, subject, body, audience_lifecycle_stage, scheduled_at, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning ${COLS}`,
      [
        tenantId,
        input.name,
        input.templateId ?? null,
        input.subject,
        input.body,
        input.audienceLifecycleStage ?? null,
        input.scheduledAt ?? null,
        initialStatus(input),
      ],
    );
    return toDomain(rows[0]);
  }

  async list(tenantId: string, limit = 100): Promise<Campaign[]> {
    const rows = await query<CampaignRow>(
      `select ${COLS} from campaigns where tenant_id = $1 order by created_at desc limit $2`,
      [tenantId, limit],
    );
    return rows.map(toDomain);
  }

  async findById(tenantId: string, id: string): Promise<Campaign | null> {
    const rows = await query<CampaignRow>(
      `select ${COLS} from campaigns where tenant_id = $1 and id = $2`,
      [tenantId, id],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async markSent(tenantId: string, id: string, recipientCount: number): Promise<Campaign> {
    const rows = await query<CampaignRow>(
      `update campaigns
         set status = 'sent', recipient_count = $3, sent_at = now(), updated_at = now()
       where tenant_id = $1 and id = $2
       returning ${COLS}`,
      [tenantId, id, recipientCount],
    );
    if (!rows[0]) throw new Error(`Campaign ${id} not found for tenant ${tenantId}`);
    return toDomain(rows[0]);
  }
}

export const campaignRepository: CampaignRepository = useInMemory
  ? memCampaigns
  : new PostgresCampaignRepository();
