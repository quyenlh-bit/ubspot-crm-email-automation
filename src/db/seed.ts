import { pool } from "./pool.js";
import { tenantRepository } from "../core/tenants/tenant.repository.js";
import { contactRepository } from "../core/contacts/contact.repository.js";
import { connectionRepository } from "../core/channels/connection.repository.js";
import { logger } from "../utils/logger.js";

/**
 * Seed a demo tenant + sample contacts so the UI has something to show without
 * a live CRM. Contacts are written straight to the core repo (no channel push),
 * so this works even with no provider connected.
 *
 * If HUBSPOT_ACCESS_TOKEN is set in the environment, a HubSpot connection is
 * created for the demo tenant too (handy for testing the real sync flow).
 *
 *   npm run db:seed
 */
async function main() {
  const existing = await tenantRepository.list();
  const tenant = existing[0] ?? (await tenantRepository.create("Demo Tenant"));
  logger.info("Seed tenant", { id: tenant.id, name: tenant.name });

  const demoContacts = [
    { email: "an.nguyen@example.com", firstName: "An", lastName: "Nguyen", lifecycleStage: "lead" },
    { email: "binh.tran@example.com", firstName: "Binh", lastName: "Tran", lifecycleStage: "customer" },
    { email: "chi.le@example.com", firstName: "Chi", lastName: "Le", lifecycleStage: "subscriber" },
  ];
  for (const c of demoContacts) {
    await contactRepository.upsertByEmail(tenant.id, c);
  }
  logger.info("Seeded contacts", { count: demoContacts.length });

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (token) {
    await connectionRepository.upsert(tenant.id, "hubspot", {
      accessToken: token,
      appSecret: process.env.HUBSPOT_APP_SECRET,
      transactionalEmailId: process.env.HUBSPOT_TRANSACTIONAL_EMAIL_ID,
    });
    logger.info("Seeded HubSpot connection from env");
  }

  logger.info("Seed complete", { tenantId: tenant.id });
  await pool.end();
}

main().catch((err) => {
  logger.error("Seed failed", { err: String(err) });
  process.exit(1);
});
