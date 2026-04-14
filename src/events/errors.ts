export type EventError =
  | { name: "EventNotFound"; message: string }
  | { name: "UnauthorizedEventAction"; message: string }
  | { name: "InvalidEventTransition"; message: string }
  | { name: "InvalidEventInput"; message: string }
  | { name: "InvalidFilter"; message: string }
  | { name: "UnexpectedDependencyError"; message: string };

export const EventNotFound = (message: string): EventError => ({
  name: "EventNotFound",
  message,
});

export const UnauthorizedEventAction = (message: string): EventError => ({
  name: "UnauthorizedEventAction",
  message,
});

export const InvalidEventTransition = (message: string): EventError => ({
  name: "InvalidEventTransition",
  message,
});

export const InvalidEventInput = (message: string): EventError => ({
  name: "InvalidEventInput",
  message,
});

export const InvalidFilter = (message: string): EventError => ({
  name: "InvalidFilter",
  message,
});

export const UnexpectedDependencyError = (message: string): EventError => ({
  name: "UnexpectedDependencyError",
  message,
});