import type { IEvent } from "../event.js";
import type { Result } from "../lib/result.js";
import type { EventError } from "../lib/errors.js";

export type UpcomingEventsTimeframe = "all-upcoming" | "this-week" | "this-weekend";

export interface IEventRepository {
  listEvents(): Promise<Result<IEvent[], EventError>>;
  listUpcomingPublishedEvents(
    now: Date,
    category?: string,
    timeframe?: UpcomingEventsTimeframe,
  ): Promise<Result<IEvent[], EventError>>;
  findById(id: number): Promise<Result<IEvent | null, EventError>>;
  save(event: IEvent): Promise<Result<IEvent, EventError>>;

  // Feature 4 — RSVP Toggle (Long)
  toggleRVSP(eventId: number, userId: string): Promise<Result<string, EventError>>;

  // Feature 10 — Event Search (Long)
  searchEvents(query: string): Promise<IEvent[]>;

  // Feature 1 — Event Creation (Haruki)
  create(event: IEvent): Promise<IEvent>;
  findOrganizerNameById(userId: string): Promise<Result<string, EventError>>;
  
  // Feature 7 — My RSVPs Dashboard (Giorgi)
  getRSVPsByUser(userId: string): Promise<any>;

  getGroupedAttendees(eventId: number): Promise<any>;
}

