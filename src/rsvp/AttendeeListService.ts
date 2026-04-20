// Feature 12 — Attendee List
// Service layer: retrieves RSVPs for an event, joins display names,
// enforces organizer/admin access. No HTTP knowledge here.

import { Ok, Err, type Result } from "../lib/result";
import type { IEventRepository } from "../repository/EventRepository";
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

    // 3. Build attendee entries from event's attendees and waitlist.
    const entries: IAttendeeEntry[] = [];

    // Add "going" attendees
    for (const attendee of event.attendees) {
      const userResult = await this.userRepo.findById(attendee.id);
      const displayName =
        userResult.ok && userResult.value ? userResult.value.displayName : attendee.displayName || "Unknown User";
      entries.push({
        userId: attendee.id,
        displayName,
        status: "going",
        createdAt: new Date(),
      });
    }

    // Add "waitlisted" attendees
    for (const waitlisted of event.waitlist) {
      const userResult = await this.userRepo.findById(waitlisted.id);
      const displayName =
        userResult.ok && userResult.value ? userResult.value.displayName : waitlisted.displayName || "Unknown User";
      entries.push({
        userId: waitlisted.id,
        displayName,
        status: "waitlisted",
        createdAt: new Date(),
      });
    }

    // 4. Group by status (no cancelled tracking in EventRepository).
    const byStatus = (s: RsvpStatus) =>
      entries.filter((e) => e.status === s).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return Ok({ going: byStatus("going"), waitlisted: byStatus("waitlisted"), cancelled: [] });
  }
}

export function CreateAttendeeListService(
  eventRepo: IEventRepository,
  userRepo: IUserRepository,
): IAttendeeListService {
  return new AttendeeListService(eventRepo, userRepo);
}
