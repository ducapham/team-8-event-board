export class InvalidInputError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "InvalidInputError";
    }
  }
  
  export class EventNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "EventNotFoundError";
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