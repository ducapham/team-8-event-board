export type EventError = 
    | { type: "UnexpectedDependencyError"; message: string }
    | { type: "EventNotFoundError"; message: string }
    | { type: "UserNotFoundError"; message: string }
    | { type: "UnknownError"; message: string };

export const EventNotFoundError = (message: string): EventError =>
    ({ type: "EventNotFoundError", message });

export const UserNotFoundError = (message: string): EventError =>
    ({ type: "UserNotFoundError", message });

export const UnknownError = (message: string): EventError =>
    ({ type: "UnknownError", message });