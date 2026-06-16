import { hubspot } from "../hubspot/client.js";
import { logger } from "../utils/logger.js";

export interface ContactInput {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  /** Any additional HubSpot contact properties. */
  [key: string]: string | undefined;
}

/**
 * Use case 2 — Sync a contact into HubSpot CRM (upsert by email).
 * Creates the contact if new, updates it if it already exists.
 */
export async function upsertContact(input: ContactInput) {
  const properties = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;

  try {
    const created = await hubspot.crm.contacts.basicApi.create({
      properties,
      associations: [],
    });
    logger.info("Contact created", { id: created.id, email: input.email });
    return created;
  } catch (err: unknown) {
    // 409 = contact already exists → fall back to update by email.
    const status = (err as { code?: number })?.code;
    if (status === 409) {
      const updated = await hubspot.crm.contacts.basicApi.update(
        input.email,
        { properties },
        "email",
      );
      logger.info("Contact updated", { id: updated.id, email: input.email });
      return updated;
    }
    logger.error("Failed to upsert contact", { email: input.email, err: String(err) });
    throw err;
  }
}

/** Fetch a single contact by email, returning null if not found. */
export async function getContactByEmail(email: string) {
  try {
    return await hubspot.crm.contacts.basicApi.getById(email, undefined, undefined, undefined, false, "email");
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 404) return null;
    throw err;
  }
}
