// Feature 12 — Attendee List
// Core RSVP data model. Status values match the project spec:
// going | waitlisted | cancelled

export type RsvpStatus = "going" | "waitlisted" | "cancelled";

export interface IRsvp {
  id: string;
  eventId: number;
  userId: string;
  status: RsvpStatus;
  createdAt: Date;
}
