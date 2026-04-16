// Feature 13 — Event Comments error types

export type CommentError =
  | { name: "CommentNotFound"; message: string }
  | { name: "CommentEventNotFound"; message: string }
  | { name: "EmptyContent"; message: string }
  | { name: "UnauthorizedDeletion"; message: string };

export const EmptyContent = (): CommentError => ({
  name: "EmptyContent",
  message: "Comment content cannot be empty.",
});

export const CommentEventNotFound = (eventId: number): CommentError => ({
  name: "CommentEventNotFound",
  message: `Event with id '${eventId}' was not found.`,
});

export const CommentNotFound = (commentId: string): CommentError => ({
  name: "CommentNotFound",
  message: `Comment '${commentId}' was not found.`,
});

export const UnauthorizedDeletion = (): CommentError => ({
  name: "UnauthorizedDeletion",
  message: "You do not have permission to delete this comment.",
});
