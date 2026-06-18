import { query } from "../../db/pool.js";
import { memSegments, useInMemory } from "../../db/memory.js";
import type { Segment, SegmentInput } from "../domain.js";

export interface SegmentRepository {
  create(tenantId: string, input: SegmentInput): Promise<Segment>;
  list(tenantId: string): Promise<Segment[]>;
  findById(tenantId: string, id: string): Promise<Segment | null>;
}

interface SegmentRow {
  id: string;
  tenant_id: string;
  name: string;
  type: Segment["type"];
  lifecycle_stages: string[];
  member_emails: string[];
  created_at: Date;
  updated_at: Date;
}

const toDomain = (r: SegmentRow): Segment => ({
  id: r.id,
  tenantId: r.tenant_id,
  name: r.name,
  type: r.type,
  lifecycleStages: r.lifecycle_stages ?? [],
  memberEmails: r.member_emails ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const COLS = "id, tenant_id, name, type, lifecycle_stages, member_emails, created_at, updated_at";

class PostgresSegmentRepository implements SegmentRepository {
  async create(tenantId: string, input: SegmentInput): Promise<Segment> {
    const rows = await query<SegmentRow>(
      `insert into segments (tenant_id, name, type, lifecycle_stages, member_emails)
       values ($1, $2, $3, $4, $5)
       returning ${COLS}`,
      [
        tenantId,
        input.name,
        input.type,
        JSON.stringify(input.lifecycleStages ?? []),
        JSON.stringify(input.memberEmails ?? []),
      ],
    );
    return toDomain(rows[0]);
  }
  async list(tenantId: string): Promise<Segment[]> {
    const rows = await query<SegmentRow>(
      `select ${COLS} from segments where tenant_id = $1 order by created_at desc`,
      [tenantId],
    );
    return rows.map(toDomain);
  }
  async findById(tenantId: string, id: string): Promise<Segment | null> {
    const rows = await query<SegmentRow>(
      `select ${COLS} from segments where tenant_id = $1 and id = $2`,
      [tenantId, id],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }
}

export const segmentRepository: SegmentRepository = useInMemory
  ? memSegments
  : new PostgresSegmentRepository();
