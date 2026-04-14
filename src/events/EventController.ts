import type { Response } from "express";
import type { IAppBrowserSession, IAuthenticatedUserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import {
  EVENT_CATEGORIES,
  EVENT_TIMEFRAMES,
  type EventStatus,
  type IEvent,
  type ResolvedEventFilters,
} from "./Event";
import type { EventError } from "./errors";
import type { EventActor, EventDetailResult, EventListResult, IEventService } from "./EventService";

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

interface EventDetailViewModel extends EventListViewModel {
  organizerId: string;
  canPublish: boolean;
  canCancel: boolean;
}

export interface IEventController {
  showEventList(
    res: Response,
    session: IAppBrowserSession,
    query: { category?: string; timeframe?: string },
  ): Promise<void>;
  showEventDetail(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
    pageError?: string | null,
  ): Promise<void>;
  publishFromForm(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
  ): Promise<void>;
  cancelFromForm(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
  ): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly service: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  private toActor(user: IAuthenticatedUserSession): EventActor {
    return { userId: user.userId, role: user.role };
  }

  private mapErrorStatus(error: EventError): number {
    if (error.name === "InvalidFilter") return 400;
    if (error.name === "EventNotFound") return 404;
    if (error.name === "UnauthorizedEventAction") return 403;
    if (error.name === "InvalidEventTransition") return 409;
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

  private toEventDetailViewModel(detail: EventDetailResult): EventDetailViewModel {
    return {
      ...this.toEventCardViewModel(detail.event),
      organizerId: detail.event.organizerId,
      canPublish: detail.permissions.canPublish,
      canCancel: detail.permissions.canCancel,
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

  private async renderDetailPage(
    res: Response,
    session: IAppBrowserSession,
    detailResult: EventDetailResult | null,
    pageError: string | null,
    status: number,
  ): Promise<void> {
    res.status(status).render("events/detail", {
      pageError,
      session,
      event: detailResult ? this.toEventDetailViewModel(detailResult) : null,
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

  async showEventDetail(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
    pageError: string | null = null,
  ): Promise<void> {
    const result = await this.service.getEventDetail(eventId, this.toActor(actor));

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Show event detail failed: ${result.value.message}`);
      await this.renderDetailPage(res, session, null, pageError ?? result.value.message, status);
      return;
    }

    await this.renderDetailPage(res, session, result.value, pageError, 200);
  }

  async publishFromForm(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
  ): Promise<void> {
    const result = await this.service.publishEvent(eventId, this.toActor(actor));

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Publish event failed: ${result.value.message}`);
      const detailResult = await this.service.getEventDetail(eventId, this.toActor(actor));
      if (detailResult.ok === true) {
        await this.renderDetailPage(res, session, detailResult.value, result.value.message, status);
        return;
      }

      await this.renderDetailPage(res, session, null, result.value.message, status);
      return;
    }

    this.logger.info(`Published event ${eventId}`);
    res.redirect(`/events/${eventId}`);
  }

  async cancelFromForm(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
  ): Promise<void> {
    const result = await this.service.cancelEvent(eventId, this.toActor(actor));

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Cancel event failed: ${result.value.message}`);
      const detailResult = await this.service.getEventDetail(eventId, this.toActor(actor));
      if (detailResult.ok === true) {
        await this.renderDetailPage(res, session, detailResult.value, result.value.message, status);
        return;
      }

      await this.renderDetailPage(res, session, null, result.value.message, status);
      return;
    }

    this.logger.info(`Cancelled event ${eventId}`);
    res.redirect(`/events/${eventId}`);
  }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}