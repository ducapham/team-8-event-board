// Feature 12 — Attendee List
// In-memory RSVP repository. Seed data lets the attendee list render
// immediately during development without needing real RSVPs.

import type { IRsvp, RsvpStatus } from "./Rsvp";
import type { IRsvpRepository } from "./RsvpRepository";

const SEED_RSVPS: IRsvp[] = [
  {
    id: "rsvp-1",
    eventId: 1,
    userId: "user-reader",
    status: "going",
    createdAt: new Date("2026-04-10T08:00:00Z"),
  },
  {
    id: "rsvp-2",
    eventId: 1,
    userId: "user-admin",
    status: "waitlisted",
    createdAt: new Date("2026-04-10T09:00:00Z"),
  },
  {
    id: "rsvp-3",
    eventId: 2,
    userId: "user-reader",
    status: "cancelled",
    createdAt: new Date("2026-04-11T10:00:00Z"),
  },
];

class InMemoryRsvpRepository implements IRsvpRepository {
  constructor(private readonly rsvps: IRsvp[]) {}

  async findByEventId(eventId: number): Promise<IRsvp[]> {
    return this.rsvps.filter((r) => r.eventId === eventId);
  }

  async findByEventAndUser(eventId: number, userId: string): Promise<IRsvp | null> {
    return this.rsvps.find((r) => r.eventId === eventId && r.userId === userId) ?? null;
  }

  async create(rsvp: IRsvp): Promise<IRsvp> {
    this.rsvps.push(rsvp);
    return rsvp;
  }

  async updateStatus(id: string, status: RsvpStatus): Promise<IRsvp | null> {
    const rsvp = this.rsvps.find((r) => r.id === id);
    if (!rsvp) return null;
    rsvp.status = status;
    return rsvp;
  }
}

export function CreateInMemoryRsvpRepository(): IRsvpRepository {
  return new InMemoryRsvpRepository([...SEED_RSVPS]);
}
