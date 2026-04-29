import { Err, Ok, type Result } from "../lib/result.js";
import type { IEventRepository } from "../repository/EventRepository.js";
import type { IEvent } from "../event.js";
import type {
  EventError,
  CreateEventError,
  GetEventError,
} from "../lib/errors.js";
import {
  EventNotFoundError,
  ForbiddenError,
  InvalidCategoryFilterError,
  InvalidInputError,
  InvalidEventTransitionError,
  InvalidTimeframeFilterError,
  UnauthorizedEventActionError,
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
  organizerName: string;
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
  getArchivedEvents(category?: string): Promise<Result<IEvent[], EventError>>;

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
    return Err(new InvalidCategoryFilterError("Category filter is invalid."));
  }

  if (timeframeValue && !isEventTimeframe(timeframeValue)) {
    return Err(new InvalidTimeframeFilterError("Timeframe filter is invalid."));
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

    const filters = filtersResult.value;
    const publishedEventsResult = await this.repo.listUpcomingPublishedEvents(
      now,
      filters.category ?? undefined,
      filters.timeframe,
    );
    if (publishedEventsResult.ok === false) {
      return Err(new UnexpectedDependencyError(publishedEventsResult.value.message));
    }

    const queryMatches = filters.query
      ? await this.repo.searchEvents(filters.query)
      : [];
    const queryMatchIds = new Set(queryMatches.map((event) => event.id));

    const publishedEvents = publishedEventsResult.value
      .map((event) => resolveEventStatus(event, now))
      .filter((event) => (filters.query ? queryMatchIds.has(event.id) : true));

    const allEventsResult = await this.repo.listEvents();
    if (allEventsResult.ok === false) {
      return Err(new UnexpectedDependencyError(allEventsResult.value.message));
    }

    const ownDrafts = allEventsResult.value
      .map((event) => resolveEventStatus(event, now))
      .filter((event) => event.status === "draft")
      .filter((event) => viewerId !== undefined && event.organizerId === viewerId)
      .filter((event) => (filters.category ? event.category.toLowerCase() === filters.category : true))
      .filter((event) => {
        if (!filters.query) {
          return true;
        }

        return queryMatchIds.has(event.id);
      });

    const filteredEvents = [...publishedEvents, ...ownDrafts]
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
  
    const foundEvent = eventLookup.value;
    const resolvedEvent = resolveEventStatus(foundEvent, now);
  
    const visibleToAll =
      resolvedEvent.status === "published" || resolvedEvent.status === "past";
  
    if (!visibleToAll && !isAdmin(actor) && !isOwner(resolvedEvent, actor)) {
      return Err(new ForbiddenError("You do not have access to this event."));
    }
  
    const organizerResult = await this.repo.findOrganizerNameById(
      resolvedEvent.organizerId,
    );
  
    if (organizerResult.ok === false) {
      return Err(organizerResult.value);
    }
  
    return Ok({
      event: resolvedEvent,
      permissions: buildPermissions(resolvedEvent, actor),
      organizerName: organizerResult.value,
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
      return Err(new UnauthorizedEventActionError("Only the organizer or an admin can publish this event."));
    }

    if (eventLookup.value.status !== "draft") {
      return Err(new InvalidEventTransitionError("Only draft events can be published."));
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

    const resolvedEvent = resolveEventStatus(saveResult.value, now);
    const organizerResult = await this.repo.findOrganizerNameById(resolvedEvent.organizerId);
    
    if (organizerResult.ok === false) {
      return Err(organizerResult.value);
    }
    
    return Ok({
      event: resolvedEvent,
      permissions: buildPermissions(resolvedEvent, actor),
      organizerName: organizerResult.value,
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
      return Err(new UnauthorizedEventActionError("Only the organizer or an admin can cancel this event."));
    }

    if (eventLookup.value.status !== "published") {
      return Err(new InvalidEventTransitionError("Only published events can be cancelled."));
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

    const resolvedEvent = resolveEventStatus(saveResult.value, now);
    const organizerResult = await this.repo.findOrganizerNameById(resolvedEvent.organizerId);
    
    if (organizerResult.ok === false) {
      return Err(organizerResult.value);
    }
    
    return Ok({
      event: resolvedEvent,
      permissions: buildPermissions(resolvedEvent, actor),
      organizerName: organizerResult.value,
    });
  }

  // Feature 11 — Past Event Archiving (Giorgi)
  async getArchivedEvents(category?: string): Promise<Result<IEvent[], EventError>> {
    return this.repo.getArchivedEvents(category);
  }

  // Feature 7 — My RSVPs Dashboard (Giorgi)
  async getMyRSVPs(userId: string): Promise<Result<any, EventError>> {
    try {
      const eventsResult = await this.repo.listEvents();

      if (eventsResult.ok === false) {
        return Err(eventsResult.value);
      }

      const events = eventsResult.value;

      const isOrganizer = events.some(
        (e: any) => e.organizerId === userId
      );
      if (isOrganizer && userId !== "user-admin") {
        return Err(new ForbiddenError("Organizers cannot access RSVP dashboard"));
      }

      const data = await this.repo.getRSVPsByUser(userId);

      const now = new Date();

      const upcoming = data
        .filter((d: any) =>
          (d.status === "Registered" || d.status === "Waitlisted") &&
          new Date(d.event.endDatetime) > now
        )
        .sort((a: any, b: any) =>
          new Date(a.event.startDatetime).getTime() -
          new Date(b.event.startDatetime).getTime()
        );

      const past = data
        .filter((d: any) =>
          new Date(d.event.endDatetime) <= now ||
          d.status === "Cancelled"
        )
        .sort((a: any, b: any) =>
          new Date(b.event.startDatetime).getTime() -
          new Date(a.event.startDatetime).getTime()
        );

      return Ok({ upcoming, past });

    } catch {
      return Err(new UnknownError("Failed to fetch RSVPs"));
    }
  }
}
export function CreateEventService(repo: IEventRepository): IEventService {
  return new EventService(repo);
}