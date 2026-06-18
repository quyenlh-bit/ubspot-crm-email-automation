import { query } from "../../db/pool.js";
import { memEnrollments, useInMemory } from "../../db/memory.js";

/**
 * Journey enrollment state: which contacts have already entered a journey, so
 * the worker only processes NEW members on each tick.
 */
export async function isEnrolled(journeyId: string, email: string): Promise<boolean> {
  if (useInMemory) return memEnrollments.isEnrolled(journeyId, email);
  const rows = await query<{ x: number }>(
    `select 1 as x from journey_enrollments where journey_id = $1 and email = $2`,
    [journeyId, email],
  );
  return rows.length > 0;
}

export async function enroll(journeyId: string, email: string): Promise<void> {
  if (useInMemory) return memEnrollments.enroll(journeyId, email);
  await query(
    `insert into journey_enrollments (journey_id, email) values ($1, $2)
     on conflict (journey_id, email) do nothing`,
    [journeyId, email],
  );
}

export async function count(journeyId: string): Promise<number> {
  if (useInMemory) return memEnrollments.count(journeyId);
  const rows = await query<{ n: string }>(
    `select count(*) as n from journey_enrollments where journey_id = $1`,
    [journeyId],
  );
  return Number(rows[0]?.n ?? 0);
}
