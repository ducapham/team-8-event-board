import { Err, Ok, type Result } from "../lib/result";
import {
  EVENT_CATEGORIES,
  EVENT_TIMEFRAMES,
  isEventCategory,
  isEventTimeframe,
  toEvent,
  type EventListInput,
  type EventTimeframe,
  type IEvent,
  type ResolvedEventFilters,
} from "./Event";
import type { IEventRepository } from "./EventRepository";
import { InvalidFilter, UnexpectedDependencyError, type EventError } from "./errors";

export interface EventListResult {
  events: IEvent[];
  filters: ResolvedEventFilters;
  availableCategories: readonly string[];
  availableTimeframes: readonly string[];
}

export interface IEventService {
  listPublishedEvents(
    input: EventListInput,
    now?: Date,
  ): Promise<Result<EventListResult, EventError>>;
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

class EventService implements IEventService {
  constructor(private readonly events: IEventRepository) {}

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
}

export function CreateEventService(events: IEventRepository): IEventService {
  return new EventService(events);
}