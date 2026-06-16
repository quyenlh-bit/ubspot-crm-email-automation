import "dotenv/config";
import { z } from "zod";

/**
 * Validates and exposes typed environment configuration.
 * Throws on startup if required secrets are missing — fail fast.
 */
const schema = z.object({
  HUBSPOT_ACCESS_TOKEN: z.string().min(1, "HUBSPOT_ACCESS_TOKEN is required"),
  HUBSPOT_APP_SECRET: z.string().min(1).optional(),
  HUBSPOT_TRANSACTIONAL_EMAIL_ID: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
