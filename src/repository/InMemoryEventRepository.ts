import type {IEventRepository } from "./EventRepository.js";
import type { IEvent, IEventSummary } from "../event";
import {Err, Ok, Result} from "../lib/result.js";
import { EventError, EventNotFoundError, UserNotFoundError } from "../lib/errors.js";
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
    time: "11:00 AM",
    organizerID: 1,
    attendees: [],
    waitlist: [],
    capacity: 50,
  },
  {
    id: 2,
    title: "Startup Pitch Night",
    description: "Founders present ideas and meet early-stage investors.",
    location: "Innovation Hub",
    category: "Business",
    date: new Date("2026-06-20"),
    time: "6:30 PM",
    organizerID: 2,
    attendees: [],
    waitlist: [],
    capacity: 30,
  },
];

class InMemoryEventRepository implements IEventRepository {
  constructor(private events: IEvent[], private users: IUserRecord[], private summary:IEventSummary[]) {}

  async toggleRVSP(eventId: number, userId: string): Promise<Result<string, EventError>> {
    const event = this.events.find((e) => e.id === eventId);
    if (!event) {
      return Err(EventNotFoundError(`Event with ID ${eventId} not found`));
    }
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      return Err(UserNotFoundError(`User with ID ${userId} not found`));
    }
    const status = this.summary.find((s) => s.Event.id === eventId && s.User.id === userId)?.status || "Not Registered";
    if (status === "Not Registered" && event.capacity > event.attendees.length) {
      event.attendees.push(user);
      this.summary.push({ id: this.summary.length + 1, date: event.date, time: event.time, status: "Registered", Event: event, User: user });
    }
    else if (status === "Not Registered" && event.capacity === event.attendees.length) {
      event.waitlist.push(user);
      this.summary.push({ id: this.summary.length + 1, date: event.date, time: event.time, status: "Waitlisted", Event: event, User: user });
    }
    else if (status === "Registered") {
      event.attendees = event.attendees.filter((u) => u.id !== userId);
      this.summary = this.summary.filter((s) => !(s.Event.id === eventId && s.User.id === userId));
      if (event.waitlist.length > 0) {
        const nextUser = event.waitlist.shift();
        if (nextUser) {
          event.attendees.push(nextUser);
          this.summary.push({ id: this.summary.length + 1, date: event.date, time: event.time, status: "Registered", Event: event, User: nextUser });
        }
      }
    }
    return Ok("RSVP updated");
  }

  async searchEvents(query: string): Promise<IEvent[]> {
    const normalized = query.toLowerCase();
    if (!normalized) {
      return this.events;
    }
    const results = this.events.filter((e) =>
      e.title.toLowerCase().includes(normalized) ||
      e.description.toLowerCase().includes(normalized) ||
      e.location.toLowerCase().includes(normalized)
    );
    return results;
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository(DEMO_EVENTS, DEMO_USERS, []);
}
