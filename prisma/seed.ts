import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { seedPrismaDemoData } from "../src/repository/prismaDemoData.js";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  process.env.DATABASE_URL = databaseUrl;

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await seedPrismaDemoData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});