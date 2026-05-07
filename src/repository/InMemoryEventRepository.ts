import type { IEventRepository, UpcomingEventsTimeframe } from "./EventRepository.js";
import type { IEvent } from "../event.js";
import type { IUserRepository } from "../auth/UserRepository.js";
import { Err, Ok, type Result } from "../lib/result.js";
import { EventError, EventNotFoundError, UserNotFoundError, RSVPNotAllowedError, UnexpectedDependencyError } from "../lib/errors.js";
import type { IUserRecord } from "../auth/User.js";

function startOfDay(value: Date): Date {
  const nextValue = new Date(value.getTime());
  nextValue.setHours(0, 0, 0, 0);
  return nextValue;
}

function addDays(value: Date, days: number): Date {
  const nextValue = new Date(value.getTime());
  nextValue.setDate(nextValue.getDate() + days);
  return nextValue;
}

function atTime(value: Date, hours: number, minutes: number): Date {
  const nextValue = new Date(value.getTime());
  nextValue.setHours(hours, minutes, 0, 0);
  return nextValue;
}

function nextWeekday(value: Date, weekday: number): Date {
  const base = startOfDay(value);
  let daysAhead = (weekday - base.getDay() + 7) % 7;
  if (daysAhead === 0) {
    daysAhead = 7;
  }

  return addDays(base, daysAhead);
}

function startOfWeek(value: Date): Date {
  const nextValue = startOfDay(value);
  const daysSinceMonday = (nextValue.getDay() + 6) % 7;
  nextValue.setDate(nextValue.getDate() - daysSinceMonday);
  return nextValue;
}

export function createDemoEvents(now: Date = new Date()): IEvent[] {
  const today = startOfDay(now);
  const tomorrowStart = atTime(addDays(today, 1), 18, 0);
  const tomorrowEnd = atTime(addDays(today, 1), 20, 0);
  const upcomingSaturday = nextWeekday(now, 6);
  const saturdayStart = atTime(upcomingSaturday, 14, 0);
  const saturdayEnd = atTime(upcomingSaturday, 17, 0);
  const upcomingTuesday = nextWeekday(now, 2);
  const tuesdayStart = atTime(upcomingTuesday, 18, 30);
  const tuesdayEnd = atTime(upcomingTuesday, 20, 0);
  const upcomingThursday = nextWeekday(now, 4);
  const thursdayStart = atTime(upcomingThursday, 17, 30);
  const thursdayEnd = atTime(upcomingThursday, 19, 30);
  const createdAt = addDays(today, -2);

  return [
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
      organizerId: "user-staff",
      attendees: [],
      waitlist: [],
      capacity: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "published",
    },
    {
      id: 101,
      title: "Neighborhood Social Mixer",
      description: "Meet nearby members, share community updates, and connect with new neighbors.",
      location: "Riverside Community Hall",
      category: "Social",
      date: startOfDay(tomorrowStart),
      time: "18:00 - 20:00",
      startDatetime: tomorrowStart,
      endDatetime: tomorrowEnd,
      organizerId: "user-staff",
      attendees: [],
      waitlist: [],
      capacity: 40,
      createdAt,
      updatedAt: createdAt,
      status: "published",
    },
    {
      id: 102,
      title: "Weekend Art Walk",
      description: "A guided walk through local galleries and pop-up exhibits featuring regional artists.",
      location: "Downtown Arts District",
      category: "Arts",
      date: startOfDay(saturdayStart),
      time: "14:00 - 17:00",
      startDatetime: saturdayStart,
      endDatetime: saturdayEnd,
      organizerId: "user-staff",
      attendees: [],
      waitlist: [],
      capacity: 1,
      createdAt,
      updatedAt: createdAt,
      status: "published",
    },
    {
      id: 103,
      title: "Accessibility Workshop",
      description: "A draft workshop plan for organizers who want to design more inclusive events.",
      location: "Library Lab Room B",
      category: "Educational",
      date: startOfDay(tuesdayStart),
      time: "18:30 - 20:00",
      startDatetime: tuesdayStart,
      endDatetime: tuesdayEnd,
      organizerId: "user-staff",
      attendees: [],
      waitlist: [],
      capacity: 20,
      createdAt,
      updatedAt: createdAt,
      status: "draft",
    },
    {
      id: 104,
      title: "Park Cleanup Drive",
      description: "Join volunteers for a cleanup and beautification session at the riverside park.",
      location: "Riverside Park Entrance",
      category: "Volunteer",
      date: startOfDay(thursdayStart),
      time: "17:30 - 19:30",
      startDatetime: thursdayStart,
      endDatetime: thursdayEnd,
      organizerId: "user-admin",
      attendees: [],
      waitlist: [],
      capacity: 60,
      createdAt,
      updatedAt: createdAt,
      status: "published",
    },
    {
      id: 105,
      title: "Spring Music Festival",
      description: "A full-day outdoor festival featuring live bands, food trucks, and local vendors.",
      location: "Town Common",
      category: "Music",
      date: startOfDay(new Date("2024-03-20T12:00:00")),
      time: "12:00 - 20:00",
      startDatetime: new Date("2024-03-20T12:00:00"),
      endDatetime: new Date("2024-03-20T20:00:00"),
      organizerId: "user-admin",
      attendees: [],
      waitlist: [],
      capacity: 200,
      createdAt,
      updatedAt: createdAt,
      status: "published",
    }
  ];
}

type RSVPStatus = "Registered" | "Waitlisted" | "Not Registered" | "Cancelled";

class InMemoryEventRepository implements IEventRepository {
  constructor(
    private events: IEvent[],
    private userRepo: IUserRepository,
    private summary: Array<{ id: number; date: Date; time: string; status: RSVPStatus; Event: IEvent; User: IUserRecord }>,
  ) {}

  async listEvents(): Promise<Result<IEvent[], EventError>> {
    try {
      return Ok(this.events);
    } catch {
      return Err(new UnexpectedDependencyError("Unable to list events."));
    }
  }

  async listUpcomingPublishedEvents(
    now: Date,
    category?: string,
    timeframe: UpcomingEventsTimeframe = "all-upcoming",
  ): Promise<Result<IEvent[], EventError>> {
    try {
      const normalizedCategory = category?.trim().toLowerCase();
      const nextWeek = addDays(startOfWeek(now), 7);
      const weekendStart = addDays(startOfWeek(now), 5);
      const events = this.events
        .filter((event) => event.status === "published")
        .filter((event) => event.startDatetime.getTime() >= now.getTime())
        .filter((event) => {
          if (!normalizedCategory) {
            return true;
          }

          return event.category.toLowerCase() === normalizedCategory;
        })
        .filter((event) => {
          if (timeframe === "this-week") {
            return event.startDatetime.getTime() < nextWeek.getTime();
          }

          if (timeframe === "this-weekend") {
            return (
              event.startDatetime.getTime() >= weekendStart.getTime() &&
              event.startDatetime.getTime() < nextWeek.getTime()
            );
          }

          return true;
        })
        .sort((left, right) => left.startDatetime.getTime() - right.startDatetime.getTime());

      return Ok(events);
    } catch {
      return Err(new UnexpectedDependencyError("Unable to list upcoming published events."));
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
    const userResult = await this.userRepo.findById(userId);
    if (!userResult.ok || !userResult.value) {
      return Err(new UserNotFoundError(`User with ID ${userId} not found`));
    }
    const user = userResult.value;

    const existingSummaryIndex = this.summary.findIndex((s) => s.Event.id === eventId && s.User.id === userId);
    const existingSummary = existingSummaryIndex >= 0 ? this.summary[existingSummaryIndex] : null;
    const status: RSVPStatus = existingSummary?.status ?? "Not Registered";
    const now = new Date();
    const eventIsPast = event.endDatetime.getTime() < now.getTime();

    if (event.status === "cancelled") {
      return Err(new RSVPNotAllowedError("Cannot RSVP to a cancelled event."));
    }

    if (eventIsPast) {
      return Err(new RSVPNotAllowedError("Cannot RSVP to a past event."));
    }


    const hasCapacity = event.capacity === undefined || event.attendees.length < event.capacity;

    if (status === "Not Registered") {
      // User never registered, now registering
      if (hasCapacity) {
        event.attendees.push(user);
        this.summary.push({ id: this.summary.length + 1, date: event.date, time: event.time, status: "Registered", Event: event, User: user });
      } else {
        event.waitlist.push(user);
        this.summary.push({ id: this.summary.length + 1, date: event.date, time: event.time, status: "Waitlisted", Event: event, User: user });
      }
    } else if (status === "Registered") {
      // User was going, now cancelling
      event.attendees = event.attendees.filter((u) => u.id !== userId);
      if (existingSummary) {
        existingSummary.status = "Cancelled";
      }
      // Promote next waitlisted user
      if (event.waitlist.length > 0) {
        const nextUser = event.waitlist.shift();
        if (nextUser) {
          event.attendees.push(nextUser);
          const nextSummaryIndex = this.summary.findIndex((s) => s.Event.id === eventId && s.User.id === nextUser.id);
          if (nextSummaryIndex >= 0) {
            this.summary[nextSummaryIndex].status = "Registered";
          }
        }
      }
    } else if (status === "Waitlisted") {
      // User was waitlisted, now cancelling
      event.waitlist = event.waitlist.filter((u) => u.id !== userId);
      if (existingSummary) {
        existingSummary.status = "Cancelled";
      }
    } else if (status === "Cancelled") {
      // User already cancelled, re-registering
      if (hasCapacity) {
        event.attendees.push(user);
        if (existingSummary) {
          existingSummary.status = "Registered";
        }
      } else {
        event.waitlist.push(user);
        if (existingSummary) {
          existingSummary.status = "Waitlisted";
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

  async findOrganizerNameById(userId: string): Promise<Result<string, EventError>> {
    const userResult = await this.userRepo.findById(userId);
  
    if (!userResult.ok) {
      return Err(new UnexpectedDependencyError("Unable to read organizer."));
    }
  
    if (!userResult.value) {
      return Err(new UserNotFoundError(`User with ID ${userId} not found`));
    }
  
    return Ok(userResult.value.displayName);
  }
  // Feature 11 — Attendee List (Giorgi)
  async getGroupedAttendees(eventId: number) {
    const filtered = this.summary.filter((s) => s.Event.id === eventId);

    return {
      going: filtered.filter((s) => s.status === "Registered"),
      waitlisted: filtered.filter((s) => s.status === "Waitlisted"),
      cancelled: filtered.filter((s) => s.status === "Cancelled"),
    };
  }

  // Feature 7 — My RSVPs Dashboard (Giorgi)
  async getRSVPsByUser(userId: string) {
    return this.summary
      .filter((s) => s.User.id === userId)
      .map((s) => ({
        event: this.events.find((event) => event.id === s.Event.id) ?? s.Event,
        status: s.status,
        date: s.date,
        time: s.time,
      }));
  }

  // Feature 11 — Past Event Archiving (Giorgi)
  async getArchivedEvents(category?: string): Promise<Result<IEvent[], EventError>> {
    const now = new Date();

    const events = this.events
      .filter((e) => e.endDatetime < now)
      .filter((e) =>
        !category || e.category.toLowerCase() === category.toLowerCase()
      )
      .sort((a, b) => b.startDatetime.getTime() - a.startDatetime.getTime());

    return Ok(events);
    }

  async isUserOrganizer(userId: string): Promise<boolean> {
    return this.events.some((e) => e.organizerId === userId);
  }
}

export function CreateInMemoryEventRepository(userRepo: IUserRepository): IEventRepository {
  return new InMemoryEventRepository(createDemoEvents(), userRepo, []);
}
