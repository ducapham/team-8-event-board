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
import { PrismaClient, EventAttendanceStatus, EventStatus } from "@prisma/client";

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
}

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
  userRepo: IUserRepository,
): IEventRepository {
  return new PrismaEventRepository(prisma, userRepo);
}