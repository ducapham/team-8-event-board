import { Err, Ok, type Result } from "../lib/result.js";
import type { IEventRepository } from "../repository/EventRepository.js";
import type { IEvent } from "../event.js";
import type {
  EventError,
  CreateEventError,
  GetEventError,
  InvalidInputError as InvalidFilterError,
} from "../lib/errors.js";
import {
  EventNotFoundError,
  ForbiddenError,
  InvalidInputError,
  UnexpectedDependencyError,
  UnknownError,
} from "../lib/errors.js";

export const EVENT_CATEGORIES = ["social", "business", "arts", "educational", "volunteer"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export const EVENT_TIMEFRAMES = ["all-upcoming", "this-week", "this-weekend"] as const;
export type EventTimeframe = (typeof EVENT_TIMEFRAMES)[number];

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  category: string;
  capacity?: number;
  startDatetime: string;
  endDatetime: string;
}

export interface ResolvedEventFilters {
  category: EventCategory | null;
  timeframe: EventTimeframe;
  query: string;
}

export interface EventListInput {
  category?: string;
  timeframe?: string;
  query?: string;
}

export interface EventListResult {
  events: IEvent[];
  filters: ResolvedEventFilters;
  availableCategories: readonly string[];
  availableTimeframes: readonly string[];
}

export interface EventActor {
  userId: string;
  role: string;
}

export interface EventPermissions {
  canPublish: boolean;
  canCancel: boolean;
}

export interface EventDetailResult {
  event: IEvent;
  permissions: EventPermissions;
}

export interface IEventService {
  getMyRSVPs(userId: string): Promise<Result<any, EventError>>;
  Toggle(eventId: number, userId: string): Promise<Result<string, EventError>>;
  Search(query: string, viewerId?: string): Promise<Result<IEvent[], EventError>>;
  createEvent(input: CreateEventInput, organizerId: string): Promise<Result<IEvent, CreateEventError>>;
  getEventById(eventId: string, viewerId?: string): Promise<Result<IEvent, GetEventError>>;
  listPublishedEvents(input: EventListInput, viewerId?: string, now?: Date): Promise<Result<EventListResult, EventError>>;
  getEventDetail(eventId: string, actor: EventActor, now?: Date): Promise<Result<EventDetailResult, EventError>>;
  publishEvent(eventId: string, actor: EventActor, now?: Date): Promise<Result<EventDetailResult, EventError>>;
  cancelEvent(eventId: string, actor: EventActor, now?: Date): Promise<Result<EventDetailResult, EventError>>;
  getGroupedAttendees(
    eventId: number,
    userId: string,
    role: string
  ): Promise<Result<any, EventError>>;
}


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

function startOfWeek(value: Date): Date {
  const nextValue = startOfDay(value);
  const daysSinceMonday = (nextValue.getDay() + 6) % 7;
  nextValue.setDate(nextValue.getDate() - daysSinceMonday);
  return nextValue;
}

function isEventCategory(value: string): value is EventCategory {
  return EVENT_CATEGORIES.includes(value as EventCategory);
}

function isEventTimeframe(value: string): value is EventTimeframe {
  return EVENT_TIMEFRAMES.includes(value as EventTimeframe);
}

function normalizeFilters(input: EventListInput): Result<ResolvedEventFilters, EventError> {
  const categoryValue = input.category?.trim().toLowerCase() ?? "";
  const timeframeValue = input.timeframe?.trim().toLowerCase() ?? "";
  const query = input.query?.trim() ?? "";

  if (categoryValue && !isEventCategory(categoryValue)) {
    return Err(new InvalidInputError("Category filter is invalid."));
  }

  if (timeframeValue && !isEventTimeframe(timeframeValue)) {
    return Err(new InvalidInputError("Timeframe filter is invalid."));
  }

  const timeframe: EventTimeframe = timeframeValue
    ? (timeframeValue as EventTimeframe)
    : "all-upcoming";

  return Ok({
    category: categoryValue ? (categoryValue as EventCategory) : null,
    timeframe,
    query,
  });
}

function isAdmin(actor: EventActor): boolean {
  return actor.role === "admin";
}

function isOwner(event: IEvent, actor: EventActor): boolean {
  return event.organizerId === actor.userId;
}

function resolveEventStatus(event: IEvent, now: Date): IEvent {
  if (event.status === "published" && event.endDatetime.getTime() < now.getTime()) {
    return { ...event, status: "past" };
  }
  return event;
}

function buildPermissions(event: IEvent, actor: EventActor): EventPermissions {
  const canManage = isAdmin(actor) || isOwner(event, actor);

  return {
    canPublish: canManage && event.status === "draft",
    canCancel: canManage && event.status === "published",
  };
}

class EventService implements IEventService {
  private searchTimeout: NodeJS.Timeout | undefined;
  private pendingSearchPromise: Promise<Result<IEvent[], EventError>> | null = null;
  private pendingSearchResolver: ((value: Result<IEvent[], EventError>) => void) | null = null;
  private latestSearchQuery = "";
  private latestSearchViewerId: string | undefined;
  private readonly searchDelayMs = 250;

  constructor(private readonly repo: IEventRepository) {}

  // Feature 4 — RSVP Toggle (Long)
  async Toggle(eventId: number, userId: string): Promise<Result<string, EventError>> {
    return this.repo.toggleRVSP(eventId, userId);
  }

  // Feature 10 — Event Search (Long)
  async Search(query: string, viewerId?: string): Promise<Result<IEvent[], EventError>> {
    this.latestSearchQuery = query;
    this.latestSearchViewerId = viewerId;

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
      const published = results
        .map((event) => resolveEventStatus(event, new Date()))
        .filter((event) => {
          const eventIsOwnedDraft = event.status === "draft" && this.latestSearchViewerId !== undefined && event.organizerId === this.latestSearchViewerId;
          const eventIsPublishedUpcoming = event.status === "published" && event.startDatetime.getTime() >= new Date().getTime();
          return eventIsPublishedUpcoming || eventIsOwnedDraft;
        })
        .sort((left, right) => left.startDatetime.getTime() - right.startDatetime.getTime());
      resolver({ ok: true, value: published });
    } catch {
      resolver({ ok: false, value: new UnknownError("Search failed") });
    }
  }

  // Feature 1 — Event Creation (Haruki)
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

    if (Number.isNaN(startDatetime.getTime()) || Number.isNaN(endDatetime.getTime())) {
      return Err(new InvalidInputError("Start and end times must be valid"));
    }

    if (endDatetime <= startDatetime) {
      return Err(new InvalidInputError("End time must be after start time"));
    }

    if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity <= 0)) {
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

  // Feature 2 — Event Detail Page (Haruki)
  async getEventById(
    eventId: string,
    viewerId?: string,
  ): Promise<Result<IEvent, GetEventError>> {
    const numericEventId = Number(eventId);
    if (Number.isNaN(numericEventId)) {
      return Err(new EventNotFoundError("Event not found"));
    }

    const eventResult = await this.repo.findById(numericEventId);
    if (eventResult.ok === false) {
      return Err(new UnexpectedDependencyError(eventResult.value.message));
    }

    if (!eventResult.value) {
      return Err(new EventNotFoundError("Event not found"));
    }

    if (eventResult.value.status === "draft" && eventResult.value.organizerId !== viewerId) {
      return Err(new ForbiddenError("Draft event not accessible"));
    }

    return Ok(eventResult.value);
  }

  // Feature 6 — Category and Date Filter (Duc)
  async listPublishedEvents(
    input: EventListInput,
    viewerId?: string,
    now: Date = new Date(),
  ): Promise<Result<EventListResult, EventError>> {
    const filtersResult = normalizeFilters(input);
    if (filtersResult.ok === false) {
      return filtersResult;
    }

    const eventsResult = await this.repo.listEvents();
    if (eventsResult.ok === false) {
      return Err(new UnexpectedDependencyError(eventsResult.value.message));
    }

    const filters = filtersResult.value;
    const nextWeek = addDays(startOfWeek(now), 7);
    const weekendStart = addDays(startOfWeek(now), 5);
    const weekendEnd = nextWeek;

    const filteredEvents = eventsResult.value
      .map((event) => resolveEventStatus(event, now))
      .filter((event) => {
        const eventIsOwnedDraft = event.status === "draft" && viewerId !== undefined && event.organizerId === viewerId;
        const eventIsPublishedUpcoming = event.status === "published" && event.startDatetime.getTime() >= now.getTime();
        return eventIsPublishedUpcoming || eventIsOwnedDraft;
      })
      .filter((event) => (filters.category ? event.category.toLowerCase() === filters.category : true))
      .filter((event) => {
        if (filters.timeframe === "this-week") {
          return event.startDatetime.getTime() < nextWeek.getTime();
        }

        if (filters.timeframe === "this-weekend") {
          return (
            event.startDatetime.getTime() >= weekendStart.getTime() &&
            event.startDatetime.getTime() < weekendEnd.getTime()
          );
        }

        return true;
      })
      .filter((event) => {
        if (!filters.query) return true;
        const search = filters.query.toLowerCase();
        return (
          event.title.toLowerCase().includes(search) ||
          event.description.toLowerCase().includes(search) ||
          event.location.toLowerCase().includes(search) ||
          event.category.toLowerCase().includes(search)
        );
      })
      .sort((left, right) => left.startDatetime.getTime() - right.startDatetime.getTime());

    return Ok({
      events: filteredEvents,
      filters,
      availableCategories: EVENT_CATEGORIES,
      availableTimeframes: EVENT_TIMEFRAMES,
    });
  }

  // Feature 2 — Event Detail Page (Haruki)
  async getEventDetail(
    eventId: string,
    actor: EventActor,
    now: Date = new Date(),
  ): Promise<Result<EventDetailResult, EventError>> {
    const eventLookup = await this.repo.findById(Number(eventId));
    if (eventLookup.ok === false) {
      return Err(new UnexpectedDependencyError(eventLookup.value.message));
    }

    if (!eventLookup.value) {
      return Err(new EventNotFoundError("Event not found."));
    }

    const event = resolveEventStatus(eventLookup.value, now);
    const visibleToAll = event.status === "published" || event.status === "past";
    if (!visibleToAll && !isAdmin(actor) && !isOwner(event, actor)) {
      return Err(new ForbiddenError("You do not have access to this event."));
    }

    return Ok({
      event,
      permissions: buildPermissions(event, actor),
    });
  }

  // Feature 5 — Event Publishing and Cancellation (Duc)
  async publishEvent(
    eventId: string,
    actor: EventActor,
    now: Date = new Date(),
  ): Promise<Result<EventDetailResult, EventError>> {
    const eventLookup = await this.repo.findById(Number(eventId));
    if (eventLookup.ok === false) {
      return Err(new UnexpectedDependencyError(eventLookup.value.message));
    }

    if (!eventLookup.value) {
      return Err(new EventNotFoundError("Event not found."));
    }

    if (!isAdmin(actor) && !isOwner(eventLookup.value, actor)) {
      return Err(new ForbiddenError("Only the organizer or an admin can publish this event."));
    }

    if (eventLookup.value.status !== "draft") {
      return Err(new InvalidInputError("Only draft events can be published."));
    }

    const updatedEvent: IEvent = {
      ...eventLookup.value,
      status: "published",
      updatedAt: new Date(now.getTime()),
    };
    const saveResult = await this.repo.save(updatedEvent);

    if (saveResult.ok === false) {
      return Err(new UnexpectedDependencyError(saveResult.value.message));
    }

    return Ok({
      event: resolveEventStatus(saveResult.value, now),
      permissions: buildPermissions(saveResult.value, actor),
    });
  }

  // Feature 5 — Event Publishing and Cancellation (Duc)
  async cancelEvent(
    eventId: string,
    actor: EventActor,
    now: Date = new Date(),
  ): Promise<Result<EventDetailResult, EventError>> {
    const eventLookup = await this.repo.findById(Number(eventId));
    if (eventLookup.ok === false) {
      return Err(new UnexpectedDependencyError(eventLookup.value.message));
    }

    if (!eventLookup.value) {
      return Err(new EventNotFoundError("Event not found."));
    }

    if (!isAdmin(actor) && !isOwner(eventLookup.value, actor)) {
      return Err(new ForbiddenError("Only the organizer or an admin can cancel this event."));
    }

    if (eventLookup.value.status !== "published") {
      return Err(new InvalidInputError("Only published events can be cancelled."));
    }

    const updatedEvent: IEvent = {
      ...eventLookup.value,
      status: "cancelled",
      updatedAt: new Date(now.getTime()),
    };
    const saveResult = await this.repo.save(updatedEvent);

    if (saveResult.ok === false) {
      return Err(new UnexpectedDependencyError(saveResult.value.message));
    }

    return Ok({
      event: resolveEventStatus(saveResult.value, now),
      permissions: buildPermissions(saveResult.value, actor),
    });
  }

  // Feature 11 — Attendee List (Giorgi)
  async getGroupedAttendees(
    eventId: number,
    userId: string,
    role: string
  ): Promise<Result<any, EventError>> {

    const eventResult = await this.repo.findById(eventId);

    if (!eventResult.ok || !eventResult.value) {
      return Err(new EventNotFoundError("Event not found"));
    }

    const event = eventResult.value;

    if (!(role === "admin" || event.organizerId === userId)) {
      return Err(new ForbiddenError("Not allowed to view attendees"));
    }

    const grouped = await this.repo.getGroupedAttendees(eventId);

    return Ok(grouped);
  }

  // Feature 7 — My RSVPs Dashboard (Giorgi)
  async getMyRSVPs(userId: string): Promise<Result<any, EventError>> {
    try {
      const data = await this.repo.getRSVPsByUser(userId);

      return Ok({
        going: data.filter((d: any) => d.status === "Registered"),
        waitlisted: data.filter((d: any) => d.status === "Waitlisted"),
        cancelled: data.filter((d: any) => d.status === "Not Registered"),
      });
    } catch {
      return Err(new UnknownError("Failed to fetch RSVPs"));
    }
  }
}

export function CreateEventService(repo: IEventRepository): IEventService {
  return new EventService(repo);
}
