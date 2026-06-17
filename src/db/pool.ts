import { Pool } from "pg";
import { env } from "../config/env.js";

/**
 * Shared Postgres connection pool (works against Supabase or any Postgres).
 * Import this everywhere instead of constructing new pools.
 *
 * In production point DATABASE_URL at Supabase's *pooled* connection string
 * (port 6543, transaction mode) so serverless/concurrent workers don't exhaust
 * direct connections.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Supabase requires TLS; `sslmode=require` in the URL also works.
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

/** Convenience typed query helper. */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
