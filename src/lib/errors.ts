export type EventError =
  | EventNotFoundError
  | UserNotFoundError
  | UnknownError
  | UnexpectedDependencyError
  | InvalidInputError
  | ForbiddenError
  | UnauthorizedEventActionError
  | InvalidEventTransitionError;

export class EventNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventNotFoundError";
  }
}

export class UserNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserNotFoundError";
  }
}

export class UnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

export class UnexpectedDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnexpectedDependencyError";
  }
}

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedEventActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedEventActionError";
  }
}

export class InvalidEventTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEventTransitionError";
  }
}

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

export type CreateEventError = InvalidInputError;
export type GetEventError = EventNotFoundError | ForbiddenError;