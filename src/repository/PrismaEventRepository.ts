import { UnknownError } from "../lib/errors.js";
import type { IEventRepository, UpcomingEventsTimeframe } from "./EventRepository.js";
import type { IEvent } from "../event.js";
import type { IUserRepository } from "../auth/UserRepository.js";
import type { IUserRecord } from "../auth/User.js";
import { Err, Ok, type Result } from "../lib/result.js";
import {
  EventError,
  EventNotFoundError,
  UserNotFoundError,
  RSVPNotAllowedError,
  UnexpectedDependencyError,
} from "../lib/errors.js";

import {
  EventAttendanceStatus,
  EventStatus,
  PrismaClient,
  Prisma,
} from "@prisma/client";

type RSVPStatus = EventAttendanceStatus | "Not Registered";

type EventWithAttendees = Prisma.EventGetPayload<{
  include: { attendees: { include: { user: true } } };
}>;

type PrismaAttendeeSummary = {
  status: "Registered" | "Waitlisted" | "Cancelled";
  date: Date;
  time: string;
  Event: IEvent;
  User: IUserRecord;
};

function toSummaryStatus(
  status: EventAttendanceStatus,
): PrismaAttendeeSummary["status"] {
  switch (status) {
    case EventAttendanceStatus.REGISTERED:
      return "Registered";
    case EventAttendanceStatus.WAITLISTED:
      return "Waitlisted";
    case EventAttendanceStatus.CANCELLED:
      return "Cancelled";
  }
}

function toUserRecord(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  passwordHash: string;
}): IUserRecord {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role as IUserRecord["role"],
    passwordHash: user.passwordHash,
  };
}

function toEventStatus(status: EventStatus): IEvent["status"] {
  switch (status) {
    case EventStatus.DRAFT:
      return "draft";
    case EventStatus.PUBLISHED:
      return "published";
    case EventStatus.CANCELLED:
      return "cancelled";
  }
}

function toPrismaEventStatus(status: IEvent["status"]): EventStatus {
  switch (status) {
    case "draft":
      return EventStatus.DRAFT;
    case "published":
      return EventStatus.PUBLISHED;
    case "cancelled":
      return EventStatus.CANCELLED;
    case "past":
      throw new Error("Past events are derived and cannot be persisted directly.");
  }
}

function toStoredCategory(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (!normalized) {
    return normalized;
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function startOfDay(value: Date): Date {
  const nextValue = new Date(value.getTime());
  nextValue.setHours(0, 0, 0, 0);
  return nextValue;
}

function addDays(value: Date, days: number): Date {
  const nextValue = new Date(value.getTime());
  nextValue.setDate(nextValue.getDate() + days);
  return nextValue;
}

function startOfWeek(value: Date): Date {
  const nextValue = startOfDay(value);
  const daysSinceMonday = (nextValue.getDay() + 6) % 7;
  nextValue.setDate(nextValue.getDate() - daysSinceMonday);
  return nextValue;
}

function buildUpcomingTimeframeWhere(now: Date, timeframe: UpcomingEventsTimeframe): Prisma.EventWhereInput {
  if (timeframe === "this-week") {
    const nextWeek = addDays(startOfWeek(now), 7);
    return {
      startDatetime: {
        gte: now,
        lt: nextWeek,
      },
    };
  }

  if (timeframe === "this-weekend") {
    const weekStart = startOfWeek(now);
    const weekendStart = addDays(weekStart, 5);
    const nextWeek = addDays(weekStart, 7);
    return {
      startDatetime: {
        gte: weekendStart,
        lt: nextWeek,
      },
    };
  }

  return {
    startDatetime: { gte: now },
  };
}

function toEvent(model: {
  id: number;
  title: string;
  description: string;
  location: string;
  category: string;
  date: Date;
  time: string;
  capacity: number;
  organizerId: string;
  startDatetime: Date;
  endDatetime: Date;
  status: EventStatus;
  createdAt: Date;
  updatedAt: Date;
  attendees?: Array<{
    status: EventAttendanceStatus;
    user: {
      id: string;
      email: string;
      displayName: string;
      role: string;
      passwordHash: string;
    };
  }>;
}): IEvent {
  const attendees = model.attendees ?? [];

  return {
    id: model.id,
    title: model.title,
    description: model.description,
    location: model.location,
    category: model.category,
    date: model.date,
    time: model.time,
    capacity: model.capacity,
    organizerId: model.organizerId,
    startDatetime: model.startDatetime,
    endDatetime: model.endDatetime,
    status: toEventStatus(model.status),
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    attendees: attendees
      .filter((entry) => entry.status === EventAttendanceStatus.REGISTERED)
      .map((entry) => toUserRecord(entry.user)),
    waitlist: attendees
      .filter((entry) => entry.status === EventAttendanceStatus.WAITLISTED)
      .map((entry) => toUserRecord(entry.user)),
  };
}

class PrismaEventRepository implements IEventRepository {
  constructor(
    private prisma: PrismaClient,
    private userRepo: IUserRepository,
  ) {}

  private async findEventRowById(id: number): Promise<EventWithAttendees | null> {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        attendees: {
          include: { user: true },
        },
      },
    });
  }

  async listEvents(): Promise<Result<IEvent[], EventError>> {
    try {
      const events = await this.prisma.event.findMany({
        include: {
          attendees: {
            include: { user: true },
          },
        },
      });

      return Ok(events.map((event) => toEvent(event)));
    } catch {
      return Err(new UnexpectedDependencyError("Unable to list events."));
    }
  }

  async listUpcomingPublishedEvents(
    now: Date,
    category?: string,
    timeframe: UpcomingEventsTimeframe = "all-upcoming",
  ): Promise<Result<IEvent[], EventError>> {
    try {
      const events = await this.prisma.event.findMany({
        where: {
          status: EventStatus.PUBLISHED,
          ...buildUpcomingTimeframeWhere(now, timeframe),
          ...(category
            ? {
                category: toStoredCategory(category),
              }
            : {}),
        },
        include: {
          attendees: {
            include: { user: true },
          },
        },
        orderBy: {
          startDatetime: "asc",
        },
      });

      return Ok(events.map((event) => toEvent(event)));
    } catch {
      return Err(new UnexpectedDependencyError("Unable to list upcoming published events."));
    }
  }

  async findById(id: number): Promise<Result<IEvent | null, EventError>> {
    try {
      const event = await this.findEventRowById(id);
      return Ok(event ? toEvent(event) : null);
    } catch {
      return Err(new UnexpectedDependencyError("Unable to read the event."));
    }
  }

  async save(event: IEvent): Promise<Result<IEvent, EventError>> {
    try {
      await this.prisma.event.update({
        where: { id: event.id },
        data: {
          title: event.title,
          description: event.description,
          location: event.location,
          category: event.category,
          date: event.date,
          time: event.time,
          capacity: event.capacity ?? 0,
          organizerId: event.organizerId,
          startDatetime: event.startDatetime,
          endDatetime: event.endDatetime,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
          status: toPrismaEventStatus(event.status),
        },
      });

      const refreshed = await this.findEventRowById(event.id);
      if (!refreshed) {
        return Err(new EventNotFoundError(`Event with ID ${event.id} not found`));
      }

      return Ok(toEvent(refreshed));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return Err(new EventNotFoundError(`Event with ID ${event.id} not found`));
      }

      if (error instanceof Error && error.message.includes("Past events are derived")) {
        return Err(new UnexpectedDependencyError(error.message));
      }

      return Err(new UnexpectedDependencyError("Unable to save the event."));
    }
  }

  async create(event: IEvent): Promise<IEvent> {
    const created = await this.prisma.event.create({
      data: {
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        category: event.category,
        date: event.date,
        time: event.time,
        capacity: event.capacity ?? 0,
        organizerId: event.organizerId,
        startDatetime: event.startDatetime,
        endDatetime: event.endDatetime,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        status: toPrismaEventStatus(event.status),
      },
      include: {
        attendees: {
          include: { user: true },
        },
      },
    });

    return toEvent(created);
  }

  async findOrganizerNameById(userId: string): Promise<Result<string, EventError>> {
    const userResult = await this.userRepo.findById(userId);

    if (!userResult.ok) {
      return Err(new UnexpectedDependencyError("Unable to read organizer."));
    }

    if (!userResult.value) {
      return Err(new UserNotFoundError(`User with ID ${userId} not found`));
    }

    return Ok(userResult.value.displayName);
  }

  async toggleRVSP(eventId: number, userId: string): Promise<Result<string, EventError>> {
    const eventResult = await this.findById(eventId);
    if (!eventResult.ok) {
      return Err(new UnexpectedDependencyError("Unable to read the event."));
    }
    const event = eventResult.value;
    if (!event) {
      return Err(new EventNotFoundError(`Event with ID ${eventId} not found`));
    }

    const userResult = await this.userRepo.findById(userId);
    if (!userResult.ok || !userResult.value) {
      return Err(new UserNotFoundError(`User with ID ${userId} not found`));
    }

    if (event.status === "cancelled") {
      return Err(new RSVPNotAllowedError("Cannot RSVP to a cancelled event."));
    }

    const now = new Date();
    if (event.endDatetime.getTime() < now.getTime()) {
      return Err(new RSVPNotAllowedError("Cannot RSVP to a past event."));
    }

    try {
      const existing = await this.prisma.eventAttendee.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });

      const status: RSVPStatus = existing?.status ?? "Not Registered";

      const registeredCount = await this.prisma.eventAttendee.count({
        where: { eventId, status: EventAttendanceStatus.REGISTERED },
      });

      const hasCapacity = event.capacity === undefined || registeredCount < event.capacity;

      if (status === "Not Registered") {
        await this.prisma.eventAttendee.create({
          data: {
            eventId,
            userId,
            status: hasCapacity
              ? EventAttendanceStatus.REGISTERED
              : EventAttendanceStatus.WAITLISTED,
          },
        });
      } else if (status === EventAttendanceStatus.REGISTERED) {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.eventAttendee.update({
            where: { userId_eventId: { userId, eventId } },
            data: { status: EventAttendanceStatus.CANCELLED },
          });

          const nextWaitlisted = await tx.eventAttendee.findFirst({
            where: { eventId, status: EventAttendanceStatus.WAITLISTED },
            orderBy: { createdAt: "asc" },
          });

          if (nextWaitlisted) {
            await tx.eventAttendee.update({
              where: { id: nextWaitlisted.id },
              data: { status: EventAttendanceStatus.REGISTERED },
            });
          }
        });
      } else if (status === EventAttendanceStatus.WAITLISTED) {
        await this.prisma.eventAttendee.update({
          where: { userId_eventId: { userId, eventId } },
          data: { status: EventAttendanceStatus.CANCELLED },
        });
      } else if (status === EventAttendanceStatus.CANCELLED) {
        await this.prisma.eventAttendee.update({
          where: { userId_eventId: { userId, eventId } },
          data: {
            status: hasCapacity
              ? EventAttendanceStatus.REGISTERED
              : EventAttendanceStatus.WAITLISTED,
          },
        });
      }
      return Ok("RSVP updated");
    } catch {
      return Err(new UnexpectedDependencyError("Unable to update RSVP."));
    }
  }

  async searchEvents(query: string): Promise<IEvent[]> {
    if (!query) {
      const rows = await this.prisma.event.findMany({
        include: {
          attendees: {
            include: { user: true },
          },
        },
      });
      return rows.map(toEvent);
    }

    const rows = await this.prisma.event.findMany({
      where: {
        OR: [
          { title:       { contains: query } },
          { description: { contains: query } },
          { location:    { contains: query } },
          { category:    { contains: query } },
        ],
      },
      include: {
        attendees: {
          include: { user: true },
        },
      },
    });
    return rows.map(toEvent);
  }

  async isUserOrganizer(userId: string): Promise<boolean> {
    const event = await this.prisma.event.findFirst({
      where: { organizerId: userId },
    });

    return event !== null;
  }


  async getRSVPsByUser(userId: string): Promise<PrismaAttendeeSummary[]> {
    const rows = await this.prisma.eventAttendee.findMany({
      where: { userId },
      include: {
        user: true,
        event: {
          include: {
            attendees: {
              include: { user: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row): PrismaAttendeeSummary & { event: IEvent } => ({
      status: toSummaryStatus(row.status),
      date: row.createdAt,
      time: row.createdAt.toISOString(),
      Event: toEvent(row.event),
      User: toUserRecord(row.user),
      event: toEvent(row.event),
    }));
  }

  async getGroupedAttendees(eventId: number): Promise<{
    going: PrismaAttendeeSummary[];
    waitlisted: PrismaAttendeeSummary[];
    cancelled: PrismaAttendeeSummary[];
  }> {
    const rows = await this.prisma.eventAttendee.findMany({
      where: { eventId },
      include: {
        user: true,
        event: {
          include: {
            attendees: {
              include: { user: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const summaries: PrismaAttendeeSummary[] = rows.map((row) => ({
      status: toSummaryStatus(row.status),
      date: row.createdAt,
      time: row.createdAt.toISOString(),
      Event: toEvent(row.event),
      User: toUserRecord(row.user),
    }));

    return {
      going: summaries.filter((row) => row.status === "Registered"),
      waitlisted: summaries.filter((row) => row.status === "Waitlisted"),
      cancelled: summaries.filter((row) => row.status === "Cancelled"),
    };
  }
  async getArchivedEvents(category?: string): Promise<Result<IEvent[], EventError>> {
    try {
      const now = new Date();

      const events = await this.prisma.event.findMany({
        where: {
          endDatetime: {
            lt: now,
          },
          ...(category
            ? {
              category: {
                equals: toStoredCategory(category),
              },
            }
            : {}),
        },
        orderBy: {
          startDatetime: "desc",
        },
      });

      return Ok(events.map(e => toEvent(e)));
    } catch {
      return Err(new UnknownError("Failed to fetch archived events"));
    }
  }

}

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
  userRepo: IUserRepository,
): IEventRepository {
  return new PrismaEventRepository(prisma, userRepo);
}