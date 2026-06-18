import "dotenv/config";
import { z } from "zod";

/**
 * Validates and exposes typed environment configuration.
 * Throws on startup if required values are missing — fail fast.
 *
 * Note: provider credentials (HubSpot access tokens, app secrets, …) are NOT
 * global env vars anymore. They live per-tenant in the `channel_connections`
 * table — see src/core/domain.ts. The platform itself only needs a database
 * and HTTP config to boot.
 */
const schema = z.object({
  // Postgres / Supabase connection string. Supabase → Project Settings →
  // Database → Connection string (URI). Use the pooled connection in prod.
  // OPTIONAL: when unset the app runs with an in-memory data store (ephemeral,
  // not persisted) so the UI can be explored without a database — see db/memory.ts.
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection URI").optional(),

  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Postgres schema the app's tables live in. Defaults to `public`; set to an
  // isolated schema (e.g. `ubspot_crm`) to run safely inside a shared database
  // without touching its public tables. Applied via search_path in db/pool.ts.
  DB_SCHEMA: z.string().min(1).default("public"),
  // Public base URL the platform is reachable at; webhook signatures from some
  // providers (e.g. HubSpot v3) are computed over the full request URL.
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
