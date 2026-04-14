export type EventError =
  | EventNotFoundError
  | UserNotFoundError
  | UnknownError
  | UnexpectedDependencyError;

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

export type CreateEventError = InvalidInputError;
export type GetEventError = EventNotFoundError | ForbiddenError;