import type { IEventRepository } from "./EventRepository.js";
import type { IEvent } from "../event.js";
import type { IUserRepository } from "../auth/UserRepository.js";
import { Err, Ok, type Result } from "../lib/result.js";
import {
  EventError,
  EventNotFoundError,
  UserNotFoundError,
  RSVPNotAllowedError,
  UnexpectedDependencyError,
} from "../lib/errors.js";
import { PrismaClient, EventAttendanceStatus, EventStatus, Prisma} from "@prisma/client";

type RSVPStatus = EventAttendanceStatus | "Not Registered";

class PrismaEventRepository implements IEventRepository {
  constructor(
    private prisma: PrismaClient,
    private userRepo: IUserRepository,
  ) {}

  async findById(id: number): Promise<Result<IEvent | null, EventError>> {
    try {
      const event = await this.prisma.event.findUnique({ where: { id } });
      return Ok(event as IEvent);
    } catch {
      return Err(new UnexpectedDependencyError("Unable to read the event."));
    }
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

    if (event.status === EventStatus.CANCELLED) {
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
        await this.prisma.$transaction(async (tx:Prisma.TransactionClient) => {
          await tx.eventAttendee.update({
            where: { userId_eventId: { userId, eventId } },
            data: { status: EventAttendanceStatus.CANCELLED},
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
      return this.prisma.event.findMany() as Promise<IEvent[]>;
    }
 
    return this.prisma.event.findMany({
      where: {
        OR: [
          { title:       { contains: query } },
          { description: { contains: query } },
          { location:    { contains: query } },
          { category:    { contains: query } },
        ],
      },
    }) as Promise<IEvent[]>;
  }
}

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
  userRepo: IUserRepository,
): IEventRepository {
  return new PrismaEventRepository(prisma, userRepo);
}