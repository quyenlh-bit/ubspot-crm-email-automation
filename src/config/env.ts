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
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection URI"),

  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
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
