import { Err, Ok, type Result } from "../lib/result";
import { cloneEventRecord, type IEventRecord } from "./Event";
import type { IEventRepository } from "./EventRepository";
import { UnexpectedDependencyError, type EventError } from "./errors";

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

function buildSeedEvents(now: Date = new Date()): IEventRecord[] {
  const today = startOfDay(now);
  const tomorrowEvening = atTime(addDays(today, 1), 18, 0);
  const tomorrowNight = atTime(addDays(today, 1), 20, 0);
  const upcomingSaturday = nextWeekday(now, 6);
  const saturdayAfternoon = atTime(upcomingSaturday, 14, 0);
  const saturdayEvening = atTime(upcomingSaturday, 17, 0);
  const nextTuesday = atTime(addDays(today, 5), 18, 30);
  const nextTuesdayLate = atTime(addDays(today, 5), 20, 0);
  const nextThursday = atTime(addDays(today, 7), 17, 30);
  const nextThursdayLate = atTime(addDays(today, 7), 19, 30);
  const createdAt = addDays(today, -2);

  return [
    {
      id: "event-neighborhood-social",
      title: "Neighborhood Social Mixer",
      description:
        "Meet nearby members, share community updates, and connect with new neighbors.",
      location: "Riverside Community Hall",
      category: "social",
      capacity: 40,
      status: "published",
      startAt: tomorrowEvening,
      endAt: tomorrowNight,
      organizerId: "user-staff",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "event-weekend-art-walk",
      title: "Weekend Art Walk",
      description:
        "A guided walk through local galleries and pop-up exhibits featuring regional artists.",
      location: "Downtown Arts District",
      category: "arts",
      capacity: null,
      status: "published",
      startAt: saturdayAfternoon,
      endAt: saturdayEvening,
      organizerId: "user-staff",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "event-draft-workshop",
      title: "Accessibility Workshop",
      description:
        "A draft workshop plan for organizers who want to design more inclusive events.",
      location: "Library Lab Room B",
      category: "educational",
      capacity: 20,
      status: "draft",
      startAt: nextTuesday,
      endAt: nextTuesdayLate,
      organizerId: "user-staff",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "event-volunteer-drive",
      title: "Park Cleanup Drive",
      description:
        "Join volunteers for a cleanup and beautification session at the riverside park.",
      location: "Riverside Park Entrance",
      category: "volunteer",
      capacity: 60,
      status: "published",
      startAt: nextThursday,
      endAt: nextThursdayLate,
      organizerId: "user-admin",
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

class InMemoryEventRepository implements IEventRepository {
  constructor(private readonly events: IEventRecord[]) {}

  async listEvents(): Promise<Result<IEventRecord[], EventError>> {
    try {
      return Ok(this.events.map(cloneEventRecord));
    } catch {
      return Err(UnexpectedDependencyError("Unable to list events."));
    }
  }

  async findById(id: string): Promise<Result<IEventRecord | null, EventError>> {
    try {
      const event = this.events.find((candidate) => candidate.id === id) ?? null;
      return Ok(event ? cloneEventRecord(event) : null);
    } catch {
      return Err(UnexpectedDependencyError("Unable to read the event."));
    }
  }

  async save(event: IEventRecord): Promise<Result<IEventRecord, EventError>> {
    try {
      const index = this.events.findIndex((candidate) => candidate.id === event.id);
      if (index === -1) {
        return Err(UnexpectedDependencyError("Unable to save the event."));
      }

      const nextEvent = cloneEventRecord(event);
      this.events[index] = nextEvent;
      return Ok(cloneEventRecord(nextEvent));
    } catch {
      return Err(UnexpectedDependencyError("Unable to save the event."));
    }
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository(buildSeedEvents());
}