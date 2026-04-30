import { EventStatus, Prisma } from "@prisma/client";
import { DEMO_USERS } from "../auth/InMemoryUserRepository.js";
import { createDemoEvents } from "./InMemoryEventRepository.js";

type PrismaSeedClient = {
  user: Prisma.UserDelegate;
  event: Prisma.EventDelegate;
  comment: Prisma.CommentDelegate;
};

export function createDemoComments(): Array<{
  id: string;
  eventId: number;
  userId: string;
  content: string;
  createdAt: Date;
}> {
  return [
    {
      id: "comment-1",
      eventId: 1,
      userId: "user-reader",
      content: "Looking forward to this! Will there be food?",
      createdAt: new Date("2026-04-10T10:00:00Z"),
    },
    {
      id: "comment-2",
      eventId: 1,
      userId: "user-admin",
      content: "Yes, snacks will be provided throughout the day.",
      createdAt: new Date("2026-04-10T11:00:00Z"),
    },
    {
      id: "comment-3",
      eventId: 2,
      userId: "user-staff",
      content: "Is parking available nearby?",
      createdAt: new Date("2026-04-11T09:00:00Z"),
    },
  ];
}

function toPrismaEventStatus(status: "draft" | "published" | "cancelled"): EventStatus {
  switch (status) {
    case "draft":
      return EventStatus.DRAFT;
    case "published":
      return EventStatus.PUBLISHED;
    case "cancelled":
      return EventStatus.CANCELLED;
  }
}

function toStoredEventStatus(status: "draft" | "published" | "cancelled" | "past"): EventStatus {
  if (status === "past") {
    throw new Error("Past events are derived and cannot be seeded as a stored status.");
  }

  return toPrismaEventStatus(status);
}

function requireCapacity(capacity: number | undefined, eventId: number): number {
  if (capacity === undefined) {
    throw new Error(`Event ${eventId} is missing capacity and cannot be seeded.`);
  }

  return capacity;
}

export async function seedPrismaDemoData(
  prisma: PrismaSeedClient,
  seedNow?: Date,
): Promise<void> {
  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        role: user.role,
        passwordHash: user.passwordHash,
      },
      create: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        passwordHash: user.passwordHash,
      },
    });
  }

  for (const event of createDemoEvents(seedNow)) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: {
        title: event.title,
        description: event.description,
        location: event.location,
        category: event.category,
        date: event.date,
        time: event.time,
        capacity: requireCapacity(event.capacity, event.id),
        organizerId: event.organizerId,
        startDatetime: event.startDatetime,
        endDatetime: event.endDatetime,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        status: toStoredEventStatus(event.status),
      },
      create: {
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        category: event.category,
        date: event.date,
        time: event.time,
        capacity: requireCapacity(event.capacity, event.id),
        organizerId: event.organizerId,
        startDatetime: event.startDatetime,
        endDatetime: event.endDatetime,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        status: toStoredEventStatus(event.status),
      },
    });
  }

  for (const comment of createDemoComments()) {
    await prisma.comment.upsert({
      where: { id: comment.id },
      update: {
        eventId: comment.eventId,
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt,
      },
      create: {
        id: comment.id,
        eventId: comment.eventId,
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt,
      },
    });
  }
}