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
// Only construct a real pool when a connection string is configured. Without
// DATABASE_URL the app runs on the in-memory backend (see db/memory.ts) and
// never touches Postgres.
export const pool = env.DATABASE_URL
  ? new Pool({
      connectionString: env.DATABASE_URL,
      // Run every connection inside the configured schema (default `public`),
      // so the app can live in an isolated schema of a shared database.
      options: `-c search_path=${env.DB_SCHEMA},public`,
      // Supabase requires TLS; `sslmode=require` in the URL also works.
      ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    })
  : null;

/** Convenience typed query helper. Throws if no database is configured. */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  if (!pool) {
    throw new Error("No DATABASE_URL configured — query() is unavailable in in-memory mode.");
  }
  const res = await pool.query(text, params);
  return res.rows as T[];
}
