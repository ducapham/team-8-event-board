export const EVENT_CATEGORIES = [
  "social",
  "educational",
  "volunteer",
  "sports",
  "arts",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_TIMEFRAMES = [
  "all-upcoming",
  "this-week",
  "this-weekend",
] as const;

export type EventTimeframe = (typeof EVENT_TIMEFRAMES)[number];

export type PersistedEventStatus = "draft" | "published" | "cancelled";
export type EventStatus = PersistedEventStatus | "past";

export interface IEventRecord {
  id: string;
  title: string;
  description: string;
  location: string;
  category: EventCategory;
  capacity: number | null;
  status: PersistedEventStatus;
  startAt: Date;
  endAt: Date;
  organizerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEvent extends Omit<IEventRecord, "status"> {
  status: EventStatus;
}

export interface EventListInput {
  category?: string;
  timeframe?: string;
}

export interface ResolvedEventFilters {
  category: EventCategory | null;
  timeframe: EventTimeframe;
}

export function isEventCategory(value: string): value is EventCategory {
  return EVENT_CATEGORIES.includes(value as EventCategory);
}

export function isEventTimeframe(value: string): value is EventTimeframe {
  return EVENT_TIMEFRAMES.includes(value as EventTimeframe);
}

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

export function cloneEventRecord(event: IEventRecord): IEventRecord {
  return {
    ...event,
    startAt: cloneDate(event.startAt),
    endAt: cloneDate(event.endAt),
    createdAt: cloneDate(event.createdAt),
    updatedAt: cloneDate(event.updatedAt),
  };
}

export function toEvent(event: IEventRecord, now: Date = new Date()): IEvent {
  const clonedEvent = cloneEventRecord(event);
  const status =
    clonedEvent.status === "published" && clonedEvent.endAt.getTime() <= now.getTime()
      ? "past"
      : clonedEvent.status;

  return {
    ...clonedEvent,
    status,
  };
}