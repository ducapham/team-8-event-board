// Feature 13 — Event Comments
// Prisma-backed comment repository. Implements the same ICommentRepository
// contract as InMemoryCommentRepository so CommentService and CommentController
// don't need to change — that's the whole point of the 4-layer architecture.

import type { PrismaClient } from "@prisma/client";
import type { IComment } from "../Comment.js";
import type { ICommentRepository } from "./CommentRepository.js";

class PrismaCommentRepository implements ICommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEventId(eventId: number): Promise<IComment[]> {
    const rows = await this.prisma.comment.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toIComment);
  }

  async findById(id: string): Promise<IComment | null> {
    const row = await this.prisma.comment.findUnique({ where: { id } });
    return row === null ? null : toIComment(row);
  }

  async create(comment: IComment): Promise<IComment> {
    // Honor the id and createdAt the service already generated so the
    // contract is identical to the in-memory repo. If they were omitted,
    // Prisma would fall back to its @default(cuid()) and @default(now())
    // — fine, but we prefer deterministic behavior controlled by the
    // service layer.
    const row = await this.prisma.comment.create({
      data: {
        id: comment.id,
        eventId: comment.eventId,
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt,
      },
    });
    return toIComment(row);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.comment.delete({ where: { id } });
      return true;
    } catch {
      // Prisma throws P2025 when the record doesn't exist; mirror the
      // in-memory repo, which returns false in that case.
      return false;
    }
  }
}

function toIComment(row: {
  id: string;
  eventId: number;
  userId: string;
  content: string;
  createdAt: Date;
}): IComment {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    content: row.content,
    createdAt: row.createdAt,
  };
}

export function CreatePrismaCommentRepository(
  prisma: PrismaClient,
): ICommentRepository {
  return new PrismaCommentRepository(prisma);
}
