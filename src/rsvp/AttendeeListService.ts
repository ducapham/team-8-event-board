// Feature 12 — Attendee List
// Service layer: retrieves RSVPs for an event, joins display names,
// enforces organizer/admin access. No HTTP knowledge here.

import { Ok, Err, type Result } from "../lib/result";
import type { IEventRepository } from "../repository/EventRepository";
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

    // 3. Use repository grouped attendee summary so cancelled is included.
    const grouped = await this.eventRepo.getGroupedAttendees(eventId);

    const normalize = (entry: any): IAttendeeEntry => ({
      userId: entry.User.id,
      displayName: entry.User.displayName ?? "Unknown User",
      status:
        entry.status === "Registered"
          ? "going"
          : entry.status === "Waitlisted"
          ? "waitlisted"
          : "cancelled",
      createdAt: entry.date instanceof Date ? entry.date : new Date(entry.date),
    });

    return Ok({
      going: grouped.going.map(normalize),
      waitlisted: grouped.waitlisted.map(normalize),
      cancelled: grouped.cancelled.map(normalize),
    });
  }
}

export function CreateAttendeeListService(
  eventRepo: IEventRepository,
): IAttendeeListService {
  return new AttendeeListService(eventRepo);
}
