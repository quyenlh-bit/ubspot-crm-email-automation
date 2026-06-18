import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./pool.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Minimal forward-only migration runner: executes every .sql file in
 * src/db/migrations in filename order. The migrations use `if not exists`, so
 * re-running is safe (idempotent) without a migrations bookkeeping table.
 *
 *   npm run db:migrate
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "migrations");

async function main() {
  if (!pool) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }
  const db = pool;

  // Tables are created in DB_SCHEMA (pool sets search_path); ensure it exists.
  if (env.DB_SCHEMA !== "public") {
    await db.query(`create schema if not exists "${env.DB_SCHEMA}"`);
    logger.info("Ensured schema", { schema: env.DB_SCHEMA });
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    logger.info("Applying migration", { file });
    await db.query(sql);
  }

  logger.info("Migrations complete", { count: files.length });
  await db.end();
}

main().catch((err) => {
  logger.error("Migration failed", { err: String(err) });
  process.exit(1);
});
