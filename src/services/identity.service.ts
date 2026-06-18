import { contactRepository } from "../core/contacts/contact.repository.js";
import type { Contact } from "../core/domain.js";
import { logger } from "../utils/logger.js";

const normalizePhone = (p?: string | null): string => (p ?? "").replace(/\D/g, "");

export interface DuplicateGroup {
  phone: string;
  contacts: Contact[];
}

/** Detect likely-duplicate contacts that share a phone number (email is unique). */
export async function findDuplicates(tenantId: string): Promise<DuplicateGroup[]> {
  const contacts = await contactRepository.list(tenantId, 1000);
  const byPhone = new Map<string, Contact[]>();
  for (const c of contacts) {
    const p = normalizePhone(c.phone);
    if (!p) continue;
    const arr = byPhone.get(p) ?? [];
    arr.push(c);
    byPhone.set(p, arr);
  }
  return [...byPhone.entries()]
    .filter(([, cs]) => cs.length > 1)
    .map(([phone, cs]) => ({ phone, contacts: cs }));
}

/**
 * Merge `secondary` into `primary`: fill missing primary fields, consolidate
 * external ids, then delete the secondary. The unified profile keeps the
 * primary's identity (id/email).
 */
export async function mergeContacts(
  tenantId: string,
  primaryId: string,
  secondaryId: string,
): Promise<Contact> {
  if (primaryId === secondaryId) throw new Error("primary and secondary must differ");
  const primary = await contactRepository.findById(tenantId, primaryId);
  const secondary = await contactRepository.findById(tenantId, secondaryId);
  if (!primary || !secondary) throw new Error("contact not found");

  await contactRepository.update(tenantId, primaryId, {
    firstName: primary.firstName ?? secondary.firstName,
    lastName: primary.lastName ?? secondary.lastName,
    phone: primary.phone ?? secondary.phone,
    lifecycleStage: primary.lifecycleStage ?? secondary.lifecycleStage,
  });
  for (const [provider, extId] of Object.entries(secondary.externalIds)) {
    if (!primary.externalIds[provider]) {
      await contactRepository.setExternalId(tenantId, primaryId, provider, extId);
    }
  }
  await contactRepository.delete(tenantId, secondaryId);

  logger.info("Merged contacts", { tenantId, primaryId, secondaryId });
  return (await contactRepository.findById(tenantId, primaryId))!;
}
