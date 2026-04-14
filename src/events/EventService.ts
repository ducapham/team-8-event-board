import { randomUUID } from "node:crypto";
import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import {
  EVENT_CATEGORIES,
  EVENT_TIMEFRAMES,
  isEventCategory,
  isEventTimeframe,
  toEvent,
  type EventListInput,
  type EventTimeframe,
  type IEvent,
  type IEventRecord,
  type ResolvedEventFilters,
} from "./Event";
import type { IEventRepository } from "./EventRepository";
import {
  EventNotFound,
  InvalidEventInput,
  InvalidEventTransition,
  InvalidFilter,
  UnauthorizedEventAction,
  UnexpectedDependencyError,
  type EventError,
} from "./errors";

export interface EventActor {
  userId: string;
  role: UserRole;
}

export interface EventPermissions {
  canPublish: boolean;
  canCancel: boolean;
}

export interface EventListResult {
  events: IEvent[];
  filters: ResolvedEventFilters;
  availableCategories: readonly string[];
  availableTimeframes: readonly string[];
}

export interface EventDetailResult {
  event: IEvent;
  permissions: EventPermissions;
}

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  category: string;
  capacity?: string;
  startDatetime: string;
  endDatetime: string;
}

export interface IEventService {
  createEvent(
    input: CreateEventInput,
    actor: EventActor,
    now?: Date,
  ): Promise<Result<EventDetailResult, EventError>>;
  listPublishedEvents(
    input: EventListInput,
    now?: Date,
  ): Promise<Result<EventListResult, EventError>>;
  getEventDetail(
    eventId: string,
    actor: EventActor,
    now?: Date,
  ): Promise<Result<EventDetailResult, EventError>>;
  publishEvent(
    eventId: string,
    actor: EventActor,
    now?: Date,
  ): Promise<Result<EventDetailResult, EventError>>;
  cancelEvent(
    eventId: string,
    actor: EventActor,
    now?: Date,
  ): Promise<Result<EventDetailResult, EventError>>;
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

function isAdmin(actor: EventActor): boolean {
  return actor.role === "admin";
}

function isOwner(event: IEventRecord, actor: EventActor): boolean {
  return event.organizerId === actor.userId;
}

function buildPermissions(event: IEventRecord, actor: EventActor, now: Date): EventPermissions {
  const readableEvent = toEvent(event, now);
  const canManage = isAdmin(actor) || isOwner(event, actor);

  return {
    canPublish: canManage && readableEvent.status === "draft",
    canCancel: canManage && readableEvent.status === "published",
  };
}

function normalizeFilters(input: EventListInput): Result<ResolvedEventFilters, EventError> {
  const categoryValue = input.category?.trim().toLowerCase() ?? "";
  const timeframeValue = input.timeframe?.trim().toLowerCase() ?? "";

  if (categoryValue && !isEventCategory(categoryValue)) {
    return Err(InvalidFilter("Category filter is invalid."));
  }

  if (timeframeValue && !isEventTimeframe(timeframeValue)) {
    return Err(InvalidFilter("Timeframe filter is invalid."));
  }

  const timeframe: EventTimeframe = timeframeValue
    ? (timeframeValue as EventTimeframe)
    : "all-upcoming";

  return Ok({
    category: categoryValue ? (categoryValue as ResolvedEventFilters["category"]) : null,
    timeframe,
  });
}

function normalizeCapacity(value: string | undefined): Result<number | null, EventError> {
  const trimmedValue = value?.trim() ?? "";
  if (!trimmedValue) {
    return Ok(null);
  }

  const parsedCapacity = Number(trimmedValue);
  if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
    return Err(InvalidEventInput("Capacity must be a positive whole number."));
  }

  return Ok(parsedCapacity);
}

class EventService implements IEventService {
  constructor(private readonly events: IEventRepository) {}

  async createEvent(
    input: CreateEventInput,
    actor: EventActor,
    now: Date = new Date(),
  ): Promise<Result<EventDetailResult, EventError>> {
    const title = input.title.trim();
    const description = input.description.trim();
    const location = input.location.trim();
    const category = input.category.trim().toLowerCase();
    const startAt = new Date(input.startDatetime);
    const endAt = new Date(input.endDatetime);

    if (!title) {
      return Err(InvalidEventInput("Title is required."));
    }

    if (!description) {
      return Err(InvalidEventInput("Description is required."));
    }

    if (!location) {
      return Err(InvalidEventInput("Location is required."));
    }

    if (!isEventCategory(category)) {
      return Err(InvalidEventInput("Category is invalid."));
    }

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return Err(InvalidEventInput("Start and end times must be valid."));
    }

    if (endAt.getTime() <= startAt.getTime()) {
      return Err(InvalidEventInput("End time must be after the start time."));
    }

    const capacityResult = normalizeCapacity(input.capacity);
    if (capacityResult.ok === false) {
      return capacityResult;
    }

    const createdAt = new Date(now.getTime());
    const nextEvent: IEventRecord = {
      id: randomUUID(),
      title,
      description,
      location,
      category,
      capacity: capacityResult.value,
      status: "draft",
      startAt,
      endAt,
      organizerId: actor.userId,
      createdAt,
      updatedAt: createdAt,
    };

    const createResult = await this.events.create(nextEvent);
    if (createResult.ok === false) {
      return Err(UnexpectedDependencyError(createResult.value.message));
    }

    return Ok({
      event: toEvent(createResult.value, now),
      permissions: buildPermissions(createResult.value, actor, now),
    });
  }

  async listPublishedEvents(
    input: EventListInput,
    now: Date = new Date(),
  ): Promise<Result<EventListResult, EventError>> {
    const filtersResult = normalizeFilters(input);
    if (filtersResult.ok === false) {
      return filtersResult;
    }

    const eventsResult = await this.events.listEvents();
    if (eventsResult.ok === false) {
      return Err(UnexpectedDependencyError(eventsResult.value.message));
    }

    const filters = filtersResult.value;
    const nextWeek = addDays(startOfWeek(now), 7);
    const weekendStart = addDays(startOfWeek(now), 5);
    const weekendEnd = nextWeek;

    const filteredEvents = eventsResult.value
      .map((event) => toEvent(event, now))
      .filter((event) => event.status === "published")
      .filter((event) => event.startAt.getTime() >= now.getTime())
      .filter((event) => (filters.category ? event.category === filters.category : true))
      .filter((event) => {
        if (filters.timeframe === "this-week") {
          return event.startAt.getTime() < nextWeek.getTime();
        }

        if (filters.timeframe === "this-weekend") {
          return (
            event.startAt.getTime() >= weekendStart.getTime() &&
            event.startAt.getTime() < weekendEnd.getTime()
          );
        }

        return true;
      })
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());

    return Ok({
      events: filteredEvents,
      filters,
      availableCategories: EVENT_CATEGORIES,
      availableTimeframes: EVENT_TIMEFRAMES,
    });
  }

  async getEventDetail(
    eventId: string,
    actor: EventActor,
    now: Date = new Date(),
  ): Promise<Result<EventDetailResult, EventError>> {
    const eventResult = await this.events.findById(eventId);
    if (eventResult.ok === false) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }

    if (!eventResult.value) {
      return Err(EventNotFound("Event not found."));
    }

    const readableEvent = toEvent(eventResult.value, now);
    const visibleToAll = readableEvent.status === "published" || readableEvent.status === "past";
    if (!visibleToAll && !isAdmin(actor) && !isOwner(eventResult.value, actor)) {
      return Err(UnauthorizedEventAction("You do not have access to this event."));
    }

    return Ok({
      event: readableEvent,
      permissions: buildPermissions(eventResult.value, actor, now),
    });
  }

  async publishEvent(
    eventId: string,
    actor: EventActor,
    now: Date = new Date(),
  ): Promise<Result<EventDetailResult, EventError>> {
    const eventResult = await this.events.findById(eventId);
    if (eventResult.ok === false) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }

    if (!eventResult.value) {
      return Err(EventNotFound("Event not found."));
    }

    const currentEvent = eventResult.value;
    if (!isAdmin(actor) && !isOwner(currentEvent, actor)) {
      return Err(UnauthorizedEventAction("Only the organizer or an admin can publish this event."));
    }

    if (toEvent(currentEvent, now).status !== "draft") {
      return Err(InvalidEventTransition("Only draft events can be published."));
    }

    const updatedEvent: IEventRecord = {
      ...currentEvent,
      status: "published",
      updatedAt: new Date(now.getTime()),
    };
    const saveResult = await this.events.save(updatedEvent);

    if (saveResult.ok === false) {
      return Err(UnexpectedDependencyError(saveResult.value.message));
    }

    return Ok({
      event: toEvent(saveResult.value, now),
      permissions: buildPermissions(saveResult.value, actor, now),
    });
  }

  async cancelEvent(
    eventId: string,
    actor: EventActor,
    now: Date = new Date(),
  ): Promise<Result<EventDetailResult, EventError>> {
    const eventResult = await this.events.findById(eventId);
    if (eventResult.ok === false) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }

    if (!eventResult.value) {
      return Err(EventNotFound("Event not found."));
    }

    const currentEvent = eventResult.value;
    if (!isAdmin(actor) && !isOwner(currentEvent, actor)) {
      return Err(UnauthorizedEventAction("Only the organizer or an admin can cancel this event."));
    }

    if (toEvent(currentEvent, now).status !== "published") {
      return Err(InvalidEventTransition("Only published events can be cancelled."));
    }

    const updatedEvent: IEventRecord = {
      ...currentEvent,
      status: "cancelled",
      updatedAt: new Date(now.getTime()),
    };
    const saveResult = await this.events.save(updatedEvent);

    if (saveResult.ok === false) {
      return Err(UnexpectedDependencyError(saveResult.value.message));
    }

    return Ok({
      event: toEvent(saveResult.value, now),
      permissions: buildPermissions(saveResult.value, actor, now),
    });
  }
}

export function CreateEventService(events: IEventRepository): IEventService {
  return new EventService(events);
}