import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import type { IUserRepository } from "../auth/UserRepository.js";
import { DEMO_USERS } from "../auth/InMemoryUserRepository.js";
import { createDemoEvents } from "./InMemoryEventRepository.js";
import { CreatePrismaEventRepository } from "./PrismaEventRepository.js";
import type { IEventRepository } from "./EventRepository.js";

type BootstrapOptions = {
  databaseUrl?: string;
  reset?: boolean;
};

type PrismaEventResources = {
  prisma: PrismaClient;
  eventRepository: IEventRepository;
  cleanup: () => Promise<void>;
};

function toSqliteFilePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Unsupported DATABASE_URL for SQLite bootstrap: ${databaseUrl}`);
  }

  const relativePath = databaseUrl.slice("file:".length).split("?")[0] ?? "./prisma/dev.db";
  return path.resolve(process.cwd(), relativePath);
}

function ensureSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "Event" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "location" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "date" DATETIME NOT NULL,
      "time" TEXT NOT NULL,
      "capacity" INTEGER NOT NULL,
      "organizerId" TEXT NOT NULL,
      "startDatetime" DATETIME NOT NULL,
      "endDatetime" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
      CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "EventAttendee" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "userId" TEXT NOT NULL,
      "eventId" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'REGISTERED',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "EventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
    CREATE UNIQUE INDEX IF NOT EXISTS "EventAttendee_userId_eventId_key" ON "EventAttendee"("userId", "eventId");
  `);

  const eventColumns = new Set(
    (database.prepare("PRAGMA table_info(\"Event\")").all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );

  if (!eventColumns.has("createdAt")) {
    database.exec(
      'ALTER TABLE "Event" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
  }

  if (!eventColumns.has("updatedAt")) {
    database.exec(
      'ALTER TABLE "Event" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
  }
}

function seedDemoData(database: Database.Database): void {
  const insertUser = database.prepare(`
    INSERT OR IGNORE INTO "User" ("id", "email", "displayName", "role", "passwordHash")
    VALUES (@id, @email, @displayName, @role, @passwordHash)
  `);

  const insertEvent = database.prepare(`
    INSERT OR IGNORE INTO "Event" (
      "id",
      "title",
      "description",
      "location",
      "category",
      "date",
      "time",
      "capacity",
      "organizerId",
      "startDatetime",
      "endDatetime",
      "createdAt",
      "updatedAt",
      "status"
    ) VALUES (
      @id,
      @title,
      @description,
      @location,
      @category,
      @date,
      @time,
      @capacity,
      @organizerId,
      @startDatetime,
      @endDatetime,
      @createdAt,
      @updatedAt,
      @status
    )
  `);

  const insertUsers = database.transaction(() => {
    for (const user of DEMO_USERS) {
      insertUser.run(user);
    }
  });

  const insertEvents = database.transaction(() => {
    for (const event of createDemoEvents()) {
      insertEvent.run({
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        category: event.category,
        date: event.date.toISOString(),
        time: event.time,
        capacity: event.capacity,
        organizerId: event.organizerId,
        startDatetime: event.startDatetime.toISOString(),
        endDatetime: event.endDatetime.toISOString(),
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        status: event.status.toUpperCase(),
      });
    }
  });

  insertUsers();
  insertEvents();
}

function ensureDatabaseReady(databasePath: string, reset: boolean): void {
  if (reset && fs.existsSync(databasePath)) {
    fs.rmSync(databasePath, { force: true });
  }

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new Database(databasePath);
  try {
    database.pragma("foreign_keys = ON");
    ensureSchema(database);
    seedDemoData(database);
  } finally {
    database.close();
  }
}

function createTempDatabaseUrl(): string {
  return `file:./.tmp/lifecycle-${randomUUID()}.db`;
}

export function createPrismaEventResources(
  userRepo: IUserRepository,
  options: BootstrapOptions = {},
): PrismaEventResources {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const databasePath = toSqliteFilePath(databaseUrl);

  ensureDatabaseReady(databasePath, options.reset ?? false);
  process.env.DATABASE_URL = databaseUrl;

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    eventRepository: CreatePrismaEventRepository(prisma, userRepo),
    cleanup: async () => {
      await prisma.$disconnect();

      if (options.reset) {
        fs.rmSync(databasePath, { force: true });
      }
    },
  };
}

export function createRuntimePrismaEventResources(
  userRepo: IUserRepository,
): PrismaEventResources {
  return createPrismaEventResources(userRepo);
}

export function createTestPrismaEventResources(
  userRepo: IUserRepository,
): PrismaEventResources {
  return createPrismaEventResources(userRepo, {
    databaseUrl: createTempDatabaseUrl(),
    reset: true,
  });
}