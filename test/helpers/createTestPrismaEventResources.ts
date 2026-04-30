import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import type { IUserRepository } from "../../src/auth/UserRepository.js";
import { DEMO_USERS } from "../../src/auth/InMemoryUserRepository.js";
import { createDemoEvents } from "../../src/repository/InMemoryEventRepository.js";
import { CreatePrismaEventRepository } from "../../src/repository/PrismaEventRepository.js";
import type { IEventRepository } from "../../src/repository/EventRepository.js";
import { createDemoComments } from "../../src/repository/prismaDemoData.js";

type TestPrismaEventResources = {
  prisma: PrismaClient;
  eventRepository: IEventRepository;
  cleanup: () => Promise<void>;
};

function createTempDatabaseUrl(): string {
  return `file:./.tmp/prisma-test-${randomUUID()}.db`;
}

function toSqliteFilePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Unsupported DATABASE_URL for SQLite test helper: ${databaseUrl}`);
  }

  const relativePath = databaseUrl.slice("file:".length).split("?")[0] ?? "./.tmp/test.db";
  return path.resolve(process.cwd(), relativePath);
}

function applyPrismaMigrations(database: Database.Database): void {
  const migrationsRoot = path.resolve(process.cwd(), "prisma", "migrations");
  const migrationDirs = fs
    .readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationDir of migrationDirs) {
    const migrationPath = path.join(migrationsRoot, migrationDir, "migration.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    database.exec(sql);
  }
}

function prepareTestDatabase(databasePath: string): void {
  if (fs.existsSync(databasePath)) {
    fs.rmSync(databasePath, { force: true });
  }

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new Database(databasePath);
  try {
    database.pragma("foreign_keys = ON");
    applyPrismaMigrations(database);
  } finally {
    database.close();
  }
}

function seedTestDatabase(databasePath: string, seedNow?: Date): void {
  const database = new Database(databasePath);
  try {
    const insertUser = database.prepare(`
      INSERT INTO "User" ("id", "email", "displayName", "role", "passwordHash")
      VALUES (@id, @email, @displayName, @role, @passwordHash)
    `);

    const insertEvent = database.prepare(`
      INSERT INTO "Event" (
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

    const insertComment = database.prepare(`
      INSERT INTO "Comment" (
        "id",
        "eventId",
        "userId",
        "content",
        "createdAt"
      ) VALUES (
        @id,
        @eventId,
        @userId,
        @content,
        @createdAt
      )
    `);

    const insertUsers = database.transaction(() => {
      for (const user of DEMO_USERS) {
        insertUser.run(user);
      }
    });

    const insertEvents = database.transaction(() => {
      for (const event of createDemoEvents(seedNow)) {
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

    const insertComments = database.transaction(() => {
      for (const comment of createDemoComments()) {
        insertComment.run({
          id: comment.id,
          eventId: comment.eventId,
          userId: comment.userId,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
        });
      }
    });

    insertUsers();
    insertEvents();
    insertComments();
  } finally {
    database.close();
  }
}

export function createTestPrismaEventResources(
  userRepo: IUserRepository,
  seedNow?: Date,
): TestPrismaEventResources {
  const databaseUrl = createTempDatabaseUrl();
  const databasePath = toSqliteFilePath(databaseUrl);

  prepareTestDatabase(databasePath);
  seedTestDatabase(databasePath, seedNow);
  process.env.DATABASE_URL = databaseUrl;

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    eventRepository: CreatePrismaEventRepository(prisma, userRepo),
    cleanup: async () => {
      await prisma.$disconnect();
      fs.rmSync(databasePath, { force: true });
    },
  };
}