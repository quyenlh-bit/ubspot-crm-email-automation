import { query } from "../../db/pool.js";
import { memJourneyRuns, useInMemory } from "../../db/memory.js";
import type { JourneyRun, JourneyRunStatus } from "../domain.js";

export interface JourneyRunRepository {
  /** Create a run at the entry node, or return the existing one (one per member). */
  enroll(tenantId: string, journeyId: string, email: string, startNodeId: string | null): Promise<JourneyRun | null>;
  /** Runs ready to advance now: active, or waiting with wake_at elapsed. */
  listDue(tenantId: string, now: Date): Promise<JourneyRun[]>;
  save(run: JourneyRun): Promise<void>;
  countByStatus(journeyId: string): Promise<Record<JourneyRunStatus, number>>;
}

interface RunRow {
  id: string;
  tenant_id: string;
  journey_id: string;
  email: string;
  current_node_id: string | null;
  status: JourneyRunStatus;
  wake_at: Date | null;
  entered_at: Date;
  updated_at: Date;
}

const toDomain = (r: RunRow): JourneyRun => ({
  id: r.id,
  tenantId: r.tenant_id,
  journeyId: r.journey_id,
  email: r.email,
  currentNodeId: r.current_node_id,
  status: r.status,
  wakeAt: r.wake_at,
  enteredAt: r.entered_at,
  updatedAt: r.updated_at,
});

const COLS = "id, tenant_id, journey_id, email, current_node_id, status, wake_at, entered_at, updated_at";

class PostgresJourneyRunRepository implements JourneyRunRepository {
  async enroll(tenantId: string, journeyId: string, email: string, startNodeId: string | null): Promise<JourneyRun | null> {
    const rows = await query<RunRow>(
      `insert into journey_runs (tenant_id, journey_id, email, current_node_id, status)
       values ($1, $2, $3, $4, 'active')
       on conflict (journey_id, email) do nothing
       returning ${COLS}`,
      [tenantId, journeyId, email, startNodeId],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }
  async listDue(tenantId: string, now: Date): Promise<JourneyRun[]> {
    const rows = await query<RunRow>(
      `select ${COLS} from journey_runs
       where tenant_id = $1 and (status = 'active' or (status = 'waiting' and wake_at <= $2))
       order by updated_at limit 500`,
      [tenantId, now],
    );
    return rows.map(toDomain);
  }
  async save(run: JourneyRun): Promise<void> {
    await query(
      `update journey_runs set current_node_id = $2, status = $3, wake_at = $4, updated_at = now() where id = $1`,
      [run.id, run.currentNodeId, run.status, run.wakeAt],
    );
  }
  async countByStatus(journeyId: string): Promise<Record<JourneyRunStatus, number>> {
    const rows = await query<{ status: JourneyRunStatus; n: string }>(
      `select status, count(*) as n from journey_runs where journey_id = $1 group by status`,
      [journeyId],
    );
    const out: Record<JourneyRunStatus, number> = { active: 0, waiting: 0, completed: 0 };
    for (const r of rows) out[r.status] = Number(r.n);
    return out;
  }
}

export const journeyRunRepository: JourneyRunRepository = useInMemory
  ? memJourneyRuns
  : new PostgresJourneyRunRepository();
