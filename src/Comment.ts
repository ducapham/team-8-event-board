// Feature 13 — Event Comments
// Core comment data model.

export interface IComment {
  id: string;
  eventId: number;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface ICommentWithAuthor {
  id: string;
  eventId: number;
  userId: string;
  authorName: string;
  content: string;
  createdAt: Date;
}
