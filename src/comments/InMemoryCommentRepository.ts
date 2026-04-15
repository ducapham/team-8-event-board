// Feature 13 — Event Comments
// In-memory comment repository with seed data for development.

import type { IComment } from "./Comment";
import type { ICommentRepository } from "./CommentRepository";

const SEED_COMMENTS: IComment[] = [
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

class InMemoryCommentRepository implements ICommentRepository {
  constructor(private readonly comments: IComment[]) {}

  async findByEventId(eventId: number): Promise<IComment[]> {
    return this.comments
      .filter((c) => c.eventId === eventId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async findById(id: string): Promise<IComment | null> {
    return this.comments.find((c) => c.id === id) ?? null;
  }

  async create(comment: IComment): Promise<IComment> {
    this.comments.push(comment);
    return comment;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.comments.findIndex((c) => c.id === id);
    if (index === -1) return false;
    this.comments.splice(index, 1);
    return true;
  }
}

export function CreateInMemoryCommentRepository(): ICommentRepository {
  return new InMemoryCommentRepository([...SEED_COMMENTS]);
}
