// Feature 12 — Attendee List
// Service layer: retrieves RSVPs for an event, joins display names,
// enforces organizer/admin access. No HTTP knowledge here.

import { Ok, Err, type Result } from "../lib/result";
import type { IEventRepository } from "../repository/EventRepository";
import type { IRsvpRepository } from "./RsvpRepository";
import type { IUserRepository } from "../auth/UserRepository";
import type { RsvpStatus } from "./Rsvp";
import { EventNotFound, UnauthorizedAttendeeList, type AttendeeListError } from "./errors";

export interface IAttendeeEntry {
  userId: string;
  displayName: string;
  status: RsvpStatus;
  createdAt: Date;
}

export interface IGroupedAttendees {
  going: IAttendeeEntry[];
  waitlisted: IAttendeeEntry[];
  cancelled: IAttendeeEntry[];
}

export interface IAttendeeListService {
  getGroupedAttendees(
    eventId: number,
    requestingUserId: string,
    requestingUserRole: string,
  ): Promise<Result<IGroupedAttendees, AttendeeListError>>;
}

class AttendeeListService implements IAttendeeListService {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly rsvpRepo: IRsvpRepository,
    private readonly userRepo: IUserRepository,
  ) {}

  async getGroupedAttendees(
    eventId: number,
    requestingUserId: string,
    requestingUserRole: string,
  ): Promise<Result<IGroupedAttendees, AttendeeListError>> {
    // 1. Verify the event exists.
    const eventResult = await this.eventRepo.findById(eventId);
    if (!eventResult.ok || !eventResult.value) {
      return Err(EventNotFound(eventId));
    }
    const event = eventResult.value;

    // 2. Enforce access: organizer or admin only.
    const isOrganizer = event.organizerId === requestingUserId;
    const isAdmin = requestingUserRole === "admin";
    if (!isOrganizer && !isAdmin) {
      return Err(UnauthorizedAttendeeList());
    }

    // 3. Fetch all RSVPs for this event.
    const rsvps = await this.rsvpRepo.findByEventId(eventId);

    // 4. Join each RSVP with the attendee's display name.
    const entries: IAttendeeEntry[] = [];
    for (const rsvp of rsvps) {
      const userResult = await this.userRepo.findById(rsvp.userId);
      const displayName =
        userResult.ok && userResult.value ? userResult.value.displayName : "Unknown User";
      entries.push({ userId: rsvp.userId, displayName, status: rsvp.status, createdAt: rsvp.createdAt });
    }

    // 5. Group by status, sorted by createdAt ascending within each group.
    const byStatus = (s: RsvpStatus) =>
      entries.filter((e) => e.status === s).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return Ok({ going: byStatus("going"), waitlisted: byStatus("waitlisted"), cancelled: byStatus("cancelled") });
  }
}

export function CreateAttendeeListService(
  eventRepo: IEventRepository,
  rsvpRepo: IRsvpRepository,
  userRepo: IUserRepository,
): IAttendeeListService {
  return new AttendeeListService(eventRepo, rsvpRepo, userRepo);
}
