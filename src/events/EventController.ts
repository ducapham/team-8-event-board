import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import {
  EVENT_CATEGORIES,
  EVENT_TIMEFRAMES,
  type EventStatus,
  type IEvent,
  type ResolvedEventFilters,
} from "./Event";
import type { EventError } from "./errors";
import type { EventListResult, IEventService } from "./EventService";

interface EventListViewModel {
  id: string;
  title: string;
  description: string;
  location: string;
  categoryLabel: string;
  status: EventStatus;
  startDisplay: string;
  endDisplay: string;
  capacityLabel: string;
}

export interface IEventController {
  showEventList(
    res: Response,
    session: IAppBrowserSession,
    query: { category?: string; timeframe?: string },
  ): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly service: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  private mapErrorStatus(error: EventError): number {
    if (error.name === "InvalidFilter") return 400;
    return 500;
  }

  private formatDate(value: Date): string {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  }

  private titleCase(value: string): string {
    return value
      .split("-")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }

  private toEventCardViewModel(event: IEvent): EventListViewModel {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      categoryLabel: this.titleCase(event.category),
      status: event.status,
      startDisplay: this.formatDate(event.startAt),
      endDisplay: this.formatDate(event.endAt),
      capacityLabel: event.capacity === null ? "No capacity limit" : `${event.capacity} spots`,
    };
  }

  private async renderListPage(
    res: Response,
    session: IAppBrowserSession,
    listResult: EventListResult | null,
    pageError: string | null,
    status: number,
  ): Promise<void> {
    const filters: ResolvedEventFilters = listResult?.filters ?? {
      category: null,
      timeframe: "all-upcoming",
    };

    res.status(status).render("events/index", {
      pageError,
      session,
      events: (listResult?.events ?? []).map((event) => this.toEventCardViewModel(event)),
      categories: listResult?.availableCategories ?? EVENT_CATEGORIES,
      timeframes: listResult?.availableTimeframes ?? EVENT_TIMEFRAMES,
      filters,
    });
  }

  async showEventList(
    res: Response,
    session: IAppBrowserSession,
    query: { category?: string; timeframe?: string },
  ): Promise<void> {
    const result = await this.service.listPublishedEvents(query);

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `List events failed: ${result.value.message}`);
      await this.renderListPage(res, session, null, result.value.message, status);
      return;
    }

    await this.renderListPage(res, session, result.value, null, 200);
  }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}