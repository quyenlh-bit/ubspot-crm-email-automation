import { segmentRepository } from "../core/segments/segment.repository.js";
import { contactRepository } from "../core/contacts/contact.repository.js";
import type { Contact, Segment, SegmentInput } from "../core/domain.js";

export const createSegment = (tenantId: string, input: SegmentInput): Promise<Segment> =>
  segmentRepository.create(tenantId, input);

export const getSegment = (tenantId: string, id: string): Promise<Segment | null> =>
  segmentRepository.findById(tenantId, id);

/**
 * Resolve a segment to its current member contacts.
 * - dynamic: contacts matching the lifecycle-stage rule (empty rule = everyone)
 * - static: contacts whose email is in the explicit member list
 */
export async function resolveMembers(tenantId: string, segment: Segment): Promise<Contact[]> {
  const contacts = await contactRepository.list(tenantId, 1000);
  if (segment.type === "static") {
    const set = new Set(segment.memberEmails);
    return contacts.filter((c) => set.has(c.email));
  }
  if (segment.lifecycleStages.length === 0) return contacts;
  const stages = new Set(segment.lifecycleStages);
  return contacts.filter((c) => stages.has(c.lifecycleStage ?? ""));
}

/** Segments with a live member count (for the segments list UI). */
export async function listSegmentsWithCount(tenantId: string) {
  const segments = await segmentRepository.list(tenantId);
  return Promise.all(
    segments.map(async (s) => ({ ...s, memberCount: (await resolveMembers(tenantId, s)).length })),
  );
}
