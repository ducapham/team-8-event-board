import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import type { IUserRepository } from "../auth/UserRepository.js";
import { CreatePrismaEventRepository } from "./PrismaEventRepository.js";
import type { IEventRepository } from "./EventRepository.js";

type RuntimePrismaEventResources = {
  prisma: PrismaClient;
  eventRepository: IEventRepository;
};

function getRuntimeDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "file:./prisma/dev.db";
}

export function createRuntimePrismaEventResources(
  userRepo: IUserRepository,
): RuntimePrismaEventResources {
  const databaseUrl = getRuntimeDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    eventRepository: CreatePrismaEventRepository(prisma, userRepo),
  };
}