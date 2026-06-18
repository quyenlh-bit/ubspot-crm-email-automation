import { query } from "../../db/pool.js";
import { memJourneys, useInMemory } from "../../db/memory.js";
import type { Journey, JourneyInput, JourneyRunSummary } from "../domain.js";

export interface JourneyRepository {
  create(tenantId: string, input: JourneyInput): Promise<Journey>;
  update(tenantId: string, id: string, input: JourneyInput): Promise<Journey>;
  setStatus(tenantId: string, id: string, status: Journey["status"]): Promise<Journey>;
  list(tenantId: string): Promise<Journey[]>;
  findById(tenantId: string, id: string): Promise<Journey | null>;
  recordRun(tenantId: string, id: string, summary: JourneyRunSummary): Promise<Journey>;
}

interface JourneyRow {
  id: string;
  tenant_id: string;
  name: string;
  segment_id: string | null;
  steps: Journey["steps"];
  trigger: Journey["trigger"];
  nodes: Journey["nodes"];
  edges: Journey["edges"];
  status: Journey["status"];
  last_run_at: Date | null;
  last_run_summary: JourneyRunSummary | null;
  created_at: Date;
  updated_at: Date;
}

const toDomain = (r: JourneyRow): Journey => ({
  id: r.id,
  tenantId: r.tenant_id,
  name: r.name,
  segmentId: r.segment_id,
  steps: r.steps ?? [],
  trigger: r.trigger ?? null,
  nodes: r.nodes ?? [],
  edges: r.edges ?? [],
  status: r.status,
  lastRunAt: r.last_run_at,
  lastRunSummary: r.last_run_summary,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const COLS =
  "id, tenant_id, name, segment_id, steps, trigger, nodes, edges, status, last_run_at, last_run_summary, created_at, updated_at";

class PostgresJourneyRepository implements JourneyRepository {
  async create(tenantId: string, input: JourneyInput): Promise<Journey> {
    const rows = await query<JourneyRow>(
      `insert into journeys (tenant_id, name, segment_id, steps, trigger, nodes, edges)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning ${COLS}`,
      [
        tenantId,
        input.name,
        input.segmentId,
        JSON.stringify(input.steps ?? []),
        input.trigger ? JSON.stringify(input.trigger) : null,
        JSON.stringify(input.nodes ?? []),
        JSON.stringify(input.edges ?? []),
      ],
    );
    return toDomain(rows[0]);
  }

  async update(tenantId: string, id: string, input: JourneyInput): Promise<Journey> {
    const rows = await query<JourneyRow>(
      `update journeys set
         name = $3, segment_id = $4, steps = $5, trigger = $6, nodes = $7, edges = $8, updated_at = now()
       where tenant_id = $1 and id = $2
       returning ${COLS}`,
      [
        tenantId,
        id,
        input.name,
        input.segmentId,
        JSON.stringify(input.steps ?? []),
        input.trigger ? JSON.stringify(input.trigger) : null,
        JSON.stringify(input.nodes ?? []),
        JSON.stringify(input.edges ?? []),
      ],
    );
    if (!rows[0]) throw new Error(`Journey ${id} not found for tenant ${tenantId}`);
    return toDomain(rows[0]);
  }

  async setStatus(tenantId: string, id: string, status: Journey["status"]): Promise<Journey> {
    const rows = await query<JourneyRow>(
      `update journeys set status = $3, updated_at = now() where tenant_id = $1 and id = $2 returning ${COLS}`,
      [tenantId, id, status],
    );
    if (!rows[0]) throw new Error(`Journey ${id} not found for tenant ${tenantId}`);
    return toDomain(rows[0]);
  }
  async list(tenantId: string): Promise<Journey[]> {
    const rows = await query<JourneyRow>(
      `select ${COLS} from journeys where tenant_id = $1 order by created_at desc`,
      [tenantId],
    );
    return rows.map(toDomain);
  }
  async findById(tenantId: string, id: string): Promise<Journey | null> {
    const rows = await query<JourneyRow>(
      `select ${COLS} from journeys where tenant_id = $1 and id = $2`,
      [tenantId, id],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }
  async recordRun(tenantId: string, id: string, summary: JourneyRunSummary): Promise<Journey> {
    const rows = await query<JourneyRow>(
      `update journeys
         set last_run_at = now(), last_run_summary = $3, updated_at = now()
       where tenant_id = $1 and id = $2
       returning ${COLS}`,
      [tenantId, id, JSON.stringify(summary)],
    );
    if (!rows[0]) throw new Error(`Journey ${id} not found for tenant ${tenantId}`);
    return toDomain(rows[0]);
  }
}

export const journeyRepository: JourneyRepository = useInMemory
  ? memJourneys
  : new PostgresJourneyRepository();
