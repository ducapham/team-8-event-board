import type { IEventRepository } from "./EventRepository.js";
import type { IEvent } from "../event.js";
import { Err, Ok, type Result } from "../lib/result.js";
import { EventError, EventNotFoundError, UserNotFoundError, UnexpectedDependencyError } from "../lib/errors.js";
import { IUserRecord } from "../auth/User.js";
import { DEMO_USERS } from "../auth/InMemoryUserRepository.js";

const DEMO_EVENTS: IEvent[] = [
  {
    id: 1,
    title: "Community Picnic",
    description: "Bring a dish, meet neighbors, and enjoy outdoor games.",
    location: "Riverside Park",
    category: "Social",
    date: new Date("2026-06-05"),
    time: "12:00 - 14:00",
    startDatetime: new Date("2026-06-05T12:00:00"),
    endDatetime: new Date("2026-06-05T14:00:00"),
    organizerId: "user-admin",
    attendees: [],
    waitlist: [],
    capacity: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "published",
  },
  {
    id: 2,
    title: "Startup Pitch Night",
    description: "Founders present ideas and meet early-stage investors.",
    location: "Innovation Hub",
    category: "Business",
    date: new Date("2026-06-20"),
    time: "18:30 - 20:30",
    startDatetime: new Date("2026-06-20T18:30:00"),
    endDatetime: new Date("2026-06-20T20:30:00"),
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "published",
    organizerId: "user-staff",
    attendees: [],
    waitlist: [],
    capacity: 30,
  },
];

type RSVPStatus = "Registered" | "Waitlisted" | "Not Registered";

class InMemoryEventRepository implements IEventRepository {
  constructor(
    private events: IEvent[],
    private users: IUserRecord[],
    private summary: Array<{ id: number; date: Date; time: string; status: RSVPStatus; Event: IEvent; User: IUserRecord }>,
  ) {}

  async listEvents(): Promise<Result<IEvent[], EventError>> {
    try {
      return Ok(this.events);
    } catch {
      return Err(new UnexpectedDependencyError("Unable to list events."));
    }
  }

  async findById(id: number): Promise<Result<IEvent | null, EventError>> {
    try {
      const event = this.events.find((candidate) => candidate.id === id) ?? null;
      return Ok(event);
    } catch {
      return Err(new UnexpectedDependencyError("Unable to read the event."));
    }
  }

  async save(event: IEvent): Promise<Result<IEvent, EventError>> {
    try {
      const index = this.events.findIndex((candidate) => candidate.id === event.id);
      if (index === -1) {
        return Err(new UnexpectedDependencyError("Unable to save the event."));
      }

      const nextEvent = { ...event, attendees: [...event.attendees], waitlist: [...event.waitlist] };
      this.events[index] = nextEvent;
      return Ok(nextEvent);
    } catch {
      return Err(new UnexpectedDependencyError("Unable to save the event."));
    }
  }

  // Feature 4 — RSVP Toggle (Long)
  async toggleRVSP(eventId: number, userId: string): Promise<Result<string, EventError>> {
    const event = this.events.find((e) => e.id === eventId);
    if (!event) {
      return Err(new EventNotFoundError(`Event with ID ${eventId} not found`));
    }
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      return Err(new UserNotFoundError(`User with ID ${userId} not found`));
    }

    const existingSummary = this.summary.find((s) => s.Event.id === eventId && s.User.id === userId);
    const status: RSVPStatus = existingSummary?.status ?? "Not Registered";
    const hasCapacity = event.capacity === undefined || event.attendees.length < event.capacity;

    if (status === "Not Registered" && hasCapacity) {
      event.attendees.push(user);
      this.summary.push({ id: this.summary.length + 1, date: event.date, time: event.time, status: "Registered", Event: event, User: user });
    } else if (status === "Not Registered") {
      event.waitlist.push(user);
      this.summary.push({ id: this.summary.length + 1, date: event.date, time: event.time, status: "Waitlisted", Event: event, User: user });
    } else if (status === "Registered") {
      event.attendees = event.attendees.filter((u) => u.id !== userId);
      this.summary = this.summary.filter((s) => !(s.Event.id === eventId && s.User.id === userId));
      if (event.waitlist.length > 0) {
        const nextUser = event.waitlist.shift();
        if (nextUser) {
          event.attendees.push(nextUser);
          this.summary = this.summary.filter((s) => !(s.Event.id === eventId && s.User.id === nextUser.id));
          this.summary.push({ id: this.summary.length + 1, date: event.date, time: event.time, status: "Registered", Event: event, User: nextUser });
        }
      }
    }
    return Ok("RSVP updated");
  }

  // Feature 10 — Event Search (Long)
  async searchEvents(query: string): Promise<IEvent[]> {
    const normalized = query.toLowerCase();
    if (!normalized) {
      return this.events;
    }
    return this.events.filter((e) =>
      e.title.toLowerCase().includes(normalized) ||
      e.description.toLowerCase().includes(normalized) ||
      e.location.toLowerCase().includes(normalized) ||
      e.category.toLowerCase().includes(normalized)
    );
  }

  // Feature 1 — Event Creation (Haruki)
  async create(event: IEvent): Promise<IEvent> {
    this.events.push(event);
    return event;
  }

  // Feature 11 — Attendee List (Giorgi)
  async getGroupedAttendees(eventId: number) {
    const filtered = this.summary.filter((s) => s.Event.id === eventId);

    return {
      going: filtered.filter((s) => s.status === "Registered"),
      waitlisted: filtered.filter((s) => s.status === "Waitlisted"),
      cancelled: filtered.filter((s) => s.status === "Not Registered"),
    };
  }

  // Feature 7 — My RSVPs Dashboard (Giorgi)
async getRSVPsByUser(userId: string) {
  return this.summary
    .filter((s) => s.User.id === userId)
    .map((s) => ({
      event: s.Event,
      status: s.status,
      date: s.date,
      time: s.time,
    }));

}
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository(DEMO_EVENTS, DEMO_USERS, []);
}
