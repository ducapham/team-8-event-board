// Feature 13 — Event Comments
// Repository interface for comment storage.
// Sprint 1 uses in-memory; Sprint 3 swaps in Prisma.

import type { IComment } from "./Comment";

export interface ICommentRepository {
  findByEventId(eventId: number): Promise<IComment[]>;
  findById(id: string): Promise<IComment | null>;
  create(comment: IComment): Promise<IComment>;
  delete(id: string): Promise<boolean>;
}
