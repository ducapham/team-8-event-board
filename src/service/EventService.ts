import { Err, Ok, type Result } from "../lib/result.js";
import type { IEventRepository } from "../repository/EventRepository.js";
import type { IEvent } from "../event.js";
import type { EventError, CreateEventError, GetEventError } from "../lib/errors.js";
import { InvalidInputError, EventNotFoundError, ForbiddenError, UnknownError } from "../lib/errors.js";

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  category: string;
  capacity?: number;
  startDatetime: string;
  endDatetime: string;
}

export interface IEventService {
  Toggle(eventId: number, userId: string): Promise<Result<string, EventError>>;
  Search(query: string): Promise<Result<IEvent[], EventError>>;
  createEvent(input: CreateEventInput, organizerId: string): Promise<Result<IEvent, CreateEventError>>;
  getEventById(eventId: string, viewerId?: string): Promise<Result<IEvent, GetEventError>>;
}

class EventService implements IEventService {
  private searchTimeout: NodeJS.Timeout | undefined;
  private pendingSearchPromise: Promise<Result<IEvent[], EventError>> | null = null;
  private pendingSearchResolver: ((value: Result<IEvent[], EventError>) => void) | null = null;
  private latestSearchQuery = "";
  private readonly searchDelayMs = 250;

  constructor(private readonly repo: IEventRepository) {}

  async Toggle(eventId: number, userId: string): Promise<Result<string, EventError>> {
    const result = await this.repo.toggleRVSP(eventId, userId);
    if (!result.ok) {
      return result;
    }
    return Ok("RSVP updated");
  }

  async Search(query: string): Promise<Result<IEvent[], EventError>> {
    this.latestSearchQuery = query;

    if (this.pendingSearchPromise) {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      this.searchTimeout = setTimeout(() => this.executePendingSearch(), this.searchDelayMs);
      return this.pendingSearchPromise;
    }

    this.pendingSearchPromise = new Promise((resolve) => {
      this.pendingSearchResolver = resolve;
      this.searchTimeout = setTimeout(() => this.executePendingSearch(), this.searchDelayMs);
    });

    return this.pendingSearchPromise;
  }

  private async executePendingSearch(): Promise<void> {
    if (!this.pendingSearchResolver) {
      return;
    }

    const resolver = this.pendingSearchResolver;
    const query = this.latestSearchQuery;

    this.searchTimeout = undefined;
    this.pendingSearchPromise = null;
    this.pendingSearchResolver = null;

    try {
      const results = await this.repo.searchEvents(query);
      resolver({ ok: true, value: results });
    } catch {
      resolver({ ok: false, value: new UnknownError("Search failed") });
    }
  }

  async createEvent(
    input: CreateEventInput,
    organizerId: string,
  ): Promise<Result<IEvent, CreateEventError>> {
    if (!organizerId.trim()) {
      return Err(new InvalidInputError("Organizer ID is required"));
    }

    if (!input.title.trim()) {
      return Err(new InvalidInputError("Title is required"));
    }

    if (!input.description.trim()) {
      return Err(new InvalidInputError("Description is required"));
    }

    if (!input.location.trim()) {
      return Err(new InvalidInputError("Location is required"));
    }

    if (!input.category.trim()) {
      return Err(new InvalidInputError("Category is required"));
    }

    const startDatetime = new Date(input.startDatetime);
    const endDatetime = new Date(input.endDatetime);

    if (
      Number.isNaN(startDatetime.getTime()) ||
      Number.isNaN(endDatetime.getTime())
    ) {
      return Err(new InvalidInputError("Start and end times must be valid"));
    }

    if (endDatetime <= startDatetime) {
      return Err(new InvalidInputError("End time must be after start time"));
    }

    if (
      input.capacity !== undefined &&
      (!Number.isInteger(input.capacity) || input.capacity <= 0)
    ) {
      return Err(new InvalidInputError("Capacity must be a positive integer"));
    }

    const now = new Date();
    const time = `${startDatetime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${endDatetime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const event: IEvent = {
      id: Date.now(),
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      category: input.category.trim(),
      date: new Date(startDatetime.toDateString()),
      time,
      status: "draft",
      capacity: input.capacity,
      startDatetime,
      endDatetime,
      organizerId,
      attendees: [],
      waitlist: [],
      createdAt: now,
      updatedAt: now,
    };

    const createdEvent = await this.repo.create(event);
    return Ok(createdEvent);
  }

  async getEventById(
    eventId: string,
    viewerId?: string,
  ): Promise<Result<IEvent, GetEventError>> {
    const numericEventId = Number(eventId);
    if (Number.isNaN(numericEventId)) {
      return Err(new EventNotFoundError("Event not found"));
    }

    const event = await this.repo.findById(numericEventId);

    if (!event) {
      return Err(new EventNotFoundError("Event not found"));
    }

    if (event.status === "draft" && event.organizerId !== viewerId) {
      return Err(new ForbiddenError("Draft event not accessible"));
    }

    return Ok(event);
  }
}

export function CreateEventService(repo: IEventRepository): IEventService {
  return new EventService(repo);
}
