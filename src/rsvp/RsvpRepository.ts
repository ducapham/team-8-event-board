// Feature 12 — Attendee List
// Repository interface for RSVP storage.
// Sprint 1 uses an in-memory implementation; Sprint 3 swaps in Prisma.

import type { IRsvp, RsvpStatus } from "./Rsvp";

export interface IRsvpRepository {
  findByEventId(eventId: number): Promise<IRsvp[]>;
  findByEventAndUser(eventId: number, userId: string): Promise<IRsvp | null>;
  create(rsvp: IRsvp): Promise<IRsvp>;
  updateStatus(id: string, status: RsvpStatus): Promise<IRsvp | null>;
}
