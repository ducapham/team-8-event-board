// Feature 12 — Attendee List error types

export type AttendeeListError =
  | { name: "EventNotFound"; message: string }
  | { name: "Unauthorized"; message: string };

export const EventNotFound = (eventId: number): AttendeeListError => ({
  name: "EventNotFound",
  message: `Event ${eventId} was not found.`,
});

export const UnauthorizedAttendeeList = (): AttendeeListError => ({
  name: "Unauthorized",
  message: "Only the event organizer or an admin may view the attendee list.",
});
