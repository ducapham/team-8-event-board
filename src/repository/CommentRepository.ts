// Feature 13 — Event Comments
// Repository interface for comment storage.

import type { IComment } from "../Comment.js";

export interface ICommentRepository {
  findByEventId(eventId: number): Promise<IComment[]>;
  findById(id: string): Promise<IComment | null>;
  create(comment: IComment): Promise<IComment>;
  delete(id: string): Promise<boolean>;
}
