import type { Response, Request } from "express";
import type { IAppBrowserSession, IAuthenticatedUserSession } from "../session/AppSession.js";
import type { ILoggingService } from "../service/LoggingService.js";
import type { IEvent } from "../event.js";
import type { EventError } from "../lib/errors.js";
import type {
  CreateEventInput,
  EventActor,
  EventDetailResult,
  EventListResult,
  IEventService,
  ResolvedEventFilters,
} from "../service/EventService.js";
import { getAuthenticatedUser, touchAppSession } from "../session/AppSession.js";

export interface IEventController {
  showEventList(
    res: Response,
    session: IAppBrowserSession,
    query: { category?: string; timeframe?: string; query?: string },
    isHtmxRequest?: boolean,
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
    isHtmxRequest?: boolean,
  ): Promise<void>;
  cancelFromForm(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
    isHtmxRequest?: boolean,
  ): Promise<void>;
  searchFromHtmx(res: Response, query: string, session: IAppBrowserSession): Promise<void>;
  toggleFromForm(res: Response, eventId: number, session: IAppBrowserSession, redirectOnSuccess?: boolean): Promise<void>;
  renderCreateForm(req: Request, res: Response): void;
  createEvent(req: Request, res: Response): Promise<void>;
  getEventDetail(req: Request, res: Response): Promise<void>;
  showMyRSVPs(res: Response, session: IAppBrowserSession): Promise<void>;
  showArchive(
    res: Response,
    session: IAppBrowserSession,
    category?: string
  ): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly service: IEventService,
    private readonly logger: ILoggingService,
    
  ) {}

  private isErrorResult<T>(result: { ok: false; value: EventError } | { ok: true; value: T }): result is { ok: false; value: EventError } {
    return result.ok === false;
  }

  private mapErrorStatus(error: EventError): number {
    if (error.name === "EventNotFoundError") return 404;
    if (error.name === "ForbiddenError") return 403;
    if (error.name === "UnauthorizedEventActionError") return 403;
    if (error.name === "RSVPNotAllowedError") return 403;
    if (error.name === "InvalidCategoryFilterError") return 400;
    if (error.name === "InvalidTimeframeFilterError") return 400;
    if (error.name === "InvalidEventTransitionError") return 409;
    if (error.name === "InvalidInputError") return 400;
    return 500;
  }

  private async renderEventsPage(
    res: Response,
    session: IAppBrowserSession,
    listResult: EventListResult | null,
    pageError: string | null,
    status: number,
  ): Promise<void> {
    const filters: ResolvedEventFilters = listResult?.filters ?? {
      category: null,
      timeframe: "all-upcoming",
      query: "",
    };

    res.status(status).render("events/index", {
      pageError,
      session,
      events: listResult?.events ?? [],
      categories: listResult?.availableCategories ?? [],
      timeframes: listResult?.availableTimeframes ?? [],
      filters,
      query: filters.query,
    });
  }

  private async renderDetailPage(
    res: Response,
    session: IAppBrowserSession,
    detailResult: EventDetailResult | null,
    pageError: string | null,
    status: number,
    options?: { layout?: boolean },
  ): Promise<void> {
    res.status(status).render("events/detail", {
      pageError,
      session,
      event: detailResult?.event ?? null,
      permissions: detailResult?.permissions ?? { canPublish: false, canCancel: false },
      organizerName: detailResult?.organizerName,
      ...(options?.layout === false ? { layout: false } : {}),
    });
  }

  private async renderLifecycleResponse(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
    pageError: string | null,
    status: number,
    isHtmxRequest: boolean,
  ): Promise<void> {
    const detailResult = await this.service.getEventDetail(eventId, {
      userId: actor.userId,
      role: actor.role,
    });

    if (detailResult.ok === false) {
      const detailStatus = this.mapErrorStatus(detailResult.value);
      const log = detailStatus >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Load lifecycle detail failed: ${detailResult.value.message}`);
      await this.renderDetailPage(
        res,
        session,
        null,
        pageError ?? detailResult.value.message,
        detailStatus,
        { layout: !isHtmxRequest },
      );
      return;
    }

    await this.renderDetailPage(
      res,
      session,
      detailResult.value,
      pageError,
      status,
      { layout: !isHtmxRequest },
    );
  }

  // Feature 6 — Category and Date Filter (Duc)
  // Feature 10 — Event Search (Long)
  async showEventList(
    res: Response,
    session: IAppBrowserSession,
    query: { category?: string; timeframe?: string; query?: string },
    isHtmxRequest = false,
  ): Promise<void> {
    const result = await this.service.listPublishedEvents(
      query,
      session.authenticatedUser?.userId,
    );

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `List events failed: ${result.value.message}`);
      if (isHtmxRequest) {
        await this.renderEventListPartial(res, session, query, result.value.message, status);
        return;
      }

      await this.renderEventsPage(res, session, null, result.value.message, status);
      return;
    }

    if (isHtmxRequest) {
      await this.renderEventListPartial(res, session, query, null, 200);
      return;
    }

    await this.renderEventsPage(res, session, result.value, null, 200);
  }

  // Feature 2 — Event Detail Page (Haruki)
  async showEventDetail(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
    pageError: string | null = null,
  ): Promise<void> {
    const result = await this.service.getEventDetail(eventId, {
      userId: actor.userId,
      role: actor.role,
    });

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Show event detail failed: ${result.value.message}`);
      await this.renderDetailPage(res, session, null, pageError ?? result.value.message, status);
      return;
    }

    await this.renderDetailPage(res, session, result.value, pageError, 200);
  }

  // Feature 5 — Event Publishing and Cancellation (Duc)
  async publishFromForm(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
    isHtmxRequest = false,
  ): Promise<void> {
    const result = await this.service.publishEvent(eventId, {
      userId: actor.userId,
      role: actor.role,
    });

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Publish event failed: ${result.value.message}`);
      await this.renderLifecycleResponse(
        res,
        session,
        eventId,
        actor,
        result.value.message,
        status,
        isHtmxRequest,
      );
      return;
    }

    this.logger.info(`Published event ${eventId}`);
    if (isHtmxRequest) {
      await this.renderLifecycleResponse(res, session, eventId, actor, null, 200, true);
      return;
    }

    res.redirect(`/events/${eventId}`);
  }

  // Feature 5 — Event Publishing and Cancellation (Duc)
  async cancelFromForm(
    res: Response,
    session: IAppBrowserSession,
    eventId: string,
    actor: IAuthenticatedUserSession,
    isHtmxRequest = false,
  ): Promise<void> {
    const result = await this.service.cancelEvent(eventId, {
      userId: actor.userId,
      role: actor.role,
    });

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Cancel event failed: ${result.value.message}`);
      await this.renderLifecycleResponse(
        res,
        session,
        eventId,
        actor,
        result.value.message,
        status,
        isHtmxRequest,
      );
      return;
    }

    this.logger.info(`Cancelled event ${eventId}`);
    if (isHtmxRequest) {
      await this.renderLifecycleResponse(res, session, eventId, actor, null, 200, true);
      return;
    }

    res.redirect(`/events/${eventId}`);
  }

  // Feature 10 — Event Search (Long)
  async renderEventListPartial(
    res: Response,
    session: IAppBrowserSession,
    query: { category?: string; timeframe?: string; query?: string },
    pageError: string | null = null,
    status = 200,
  ): Promise<void> {
    const result = await this.service.listPublishedEvents(query, session.authenticatedUser?.userId);

    if (result.ok === false) {
      const statusCode = this.mapErrorStatus(result.value);
      const log = statusCode >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `List events failed: ${result.value.message}`);
      res.status(statusCode).render("events/partials/list", {
        layout: false,
        pageError: result.value.message,
        events: [],
        session,
        query: query.query ?? "",
      });
      return;
    }

    res.status(status).render("events/partials/list", {
      layout: false,
      pageError,
      events: result.value.events,
      session,
      query: result.value.filters.query,
    });
  }

  async searchFromHtmx(res: Response, query: string, session: IAppBrowserSession): Promise<void> {
    const result = await this.service.Search(query, session.authenticatedUser?.userId);

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Event search failed: ${result.value.message}`);
      res.status(status);
      res.render("events/partials/list", {
        layout: false,
        pageError: result.value.message,
        events: [],
        session,
        query,
      });
      return;
    }

    res.render("events/partials/list", {
      layout: false,
      pageError: null,
      events: result.value,
      session,
      query,
    });
  }

  // Feature 4 — RSVP Toggle (Long)
  async toggleFromForm(
    res: Response,
    eventId: number,
    session: IAppBrowserSession,
    redirectOnSuccess = true,
  ): Promise<void> {
    const result = await this.service.Toggle(eventId, session.authenticatedUser?.userId ?? "");

    if (this.isErrorResult(result)) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Event RSVP toggle failed: ${result.value.message}`);
      await this.renderEventListPartial(
        res,
        session,
        { category: undefined, timeframe: undefined, query: undefined },
        result.value.message,
        status,
      );
      return;
    }

    if (res.req.get("HX-Request") === "true" && res.req.query.from === "my-rsvps") {
      const result = await this.service.getMyRSVPs(
        session.authenticatedUser?.userId ?? ""
      );

      return res.render("partials/my-rsvps-columns", {
        going: result.value.going,
        waitlisted: result.value.waitlisted,
        cancelled: result.value.cancelled,
        layout: false,
      });
    }

    if (redirectOnSuccess) {
      res.redirect("/events");
      return;
    }

    await this.renderEventListPartial(
      res,
      session,
      { category: undefined, timeframe: undefined, query: undefined },
      null,
    );
  }

  // Feature 1 — Event Creation (Haruki)
  renderCreateForm(req: Request, res: Response): void {
    const browserSession = touchAppSession(req.session);

    res.render("events/new", {
      session: browserSession,
      pageError: null,
    });
  }

  async createEvent(req: Request, res: Response): Promise<void> {
    const authenticatedUser = getAuthenticatedUser(req.session);
    const organizerId = authenticatedUser?.userId;

    if (!organizerId) {
      res.status(401).render("partials/error", {
        message: "You must be logged in to create an event.",
        layout: false,
      });
      return;
    }

    const result = await this.service.createEvent(
      {
        title: req.body.title,
        description: req.body.description,
        location: req.body.location,
        category: req.body.category,
        capacity:
          req.body.capacity && req.body.capacity.trim() !== ""
            ? Number(req.body.capacity)
            : undefined,
        startDatetime: req.body.startDatetime,
        endDatetime: req.body.endDatetime,
      },
      organizerId,
    );

    if (result.ok === false) {
      const err = result.value;
      res.status(400).render("partials/error", {
        message: err.message,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${result.value.id}`);
  }

  async getEventDetail(req: Request, res: Response): Promise<void> {
    const authenticatedUser = getAuthenticatedUser(req.session);
    const viewerId = authenticatedUser?.userId;
    const eventId = req.params.id as string;

    const result = await this.service.getEventDetail(eventId, {
      userId: viewerId ?? "",
      role: authenticatedUser?.role ?? "user",
    });

    if (result.ok === false) {
      const err = result.value;

      if (err.name === "EventNotFoundError") {
        res.status(404).render("partials/error", {
          message: err.message,
          layout: false,
        });
        return;
      }

      if (err.name === "ForbiddenError") {
        res.status(403).render("partials/error", {
          message: err.message,
          layout: false,
        });
        return;
      }

      res.status(400).render("partials/error", {
        message: err.message,
        layout: false,
      });
      return;
    }

    const browserSession = touchAppSession(req.session);
    res.render("events/detail", {
      event: result.value.event,
      permissions: result.value.permissions,
      organizerName: result.value.organizerName,
      session: browserSession,
      pageError: null,
    });
  }

  // Feature 11 — Past Event Archiving (Giorgi)
  async showArchive(
    res: Response,
    session: IAppBrowserSession,
    category?: string
  ): Promise<void> {
    const result = await this.service.getArchivedEvents(category);

    if (result.ok === false) {
      return res.status(500).render("archive", {
        pageError: result.value.message,
        session,
        events: [],
      });
    }

    const req = res.req;

    if (req.get("HX-Request") === "true") {
      return res.render("partials/archive-list", {
        events: result.value,
        session,
        layout: false,
      });
    }

    return res.render("archive", {
      pageError: null,
      session,
      events: result.value,
    });
  }

  // Feature 7 — My RSVPs Dashboard (Giorgi)
  async showMyRSVPs(res: Response, session: IAppBrowserSession): Promise<void> {
    const userId = session.authenticatedUser?.userId ?? "";

    const result = await this.service.getMyRSVPs(userId);

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `My RSVPs failed: ${result.value.message}`);

      res.status(status).render("my-rsvps", {
        pageError: result.value.message,
        session,
        going: [],
        waitlisted: [],
        cancelled: [],
      });
      return;
    }

    res.render("my-rsvps", {
      pageError: null,
      session,
      going: result.value.going,
      waitlisted: result.value.waitlisted,
      cancelled: result.value.cancelled,
    });
  }

}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}
