import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession.js";
import type { IEvent } from "../event.js";
import type { EventError } from "../lib/errors.js";
import type { IEventService } from "../service/EventService.js";
import type { ILoggingService } from "../service/LoggingService.js";
import type { Result } from "../lib/result.js";

export interface IEventController {
  showEvents(res: Response, session: IAppBrowserSession, pageError?: string | null): Promise<void>;
  toggleFromForm(res: Response, eventId: number, session: IAppBrowserSession): Promise<void>;
  searchFromHtmx(res: Response, query: string, session: IAppBrowserSession): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly service: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  private isErrorResult<T>(result: Result<T, EventError>): result is { ok: false; value: EventError } {
    return result.ok === false;
  }

  private mapErrorStatus(error: EventError): number {
    if (error.type === "EventNotFoundError") return 404;
    if (error.type === "UserNotFoundError") return 404;
    return 500;
  }

  private async renderEventsPage(
    res: Response,
    session: IAppBrowserSession,
    pageError: string | null = null,
    events: IEvent[] = [],
  ): Promise<void> {
    res.render("events/index", {
      pageError,
      session,
      events,
    });
  }

  async showEvents(res: Response, session: IAppBrowserSession, pageError: string | null = null): Promise<void> {
    const searchResult = await this.service.Search("");

    if (this.isErrorResult(searchResult)) {
      const status = this.mapErrorStatus(searchResult.value);
      this.logger.warn(`Unable to load events: ${searchResult.value.message}`);
      res.status(status);
      await this.renderEventsPage(res, session, searchResult.value.message, []);
      return;
    }

    await this.renderEventsPage(res, session, pageError, searchResult.value);
  }

  async toggleFromForm(res: Response, eventId: number, session: IAppBrowserSession): Promise<void> {
    const result = await this.service.Toggle(eventId, session.authenticatedUser?.userId ?? "");

    if (this.isErrorResult(result)) {
      const status = this.mapErrorStatus(result.value);
      this.logger.warn(`Event RSVP toggle failed: ${result.value.message}`);
      res.status(status);
      await this.showEvents(res, session, result.value.message);
      return;
    }

    res.redirect("/events");
  }

  async searchFromHtmx(res: Response, query: string, session: IAppBrowserSession): Promise<void> {
    const result = await this.service.Search(query);

    if (this.isErrorResult(result)) {
      const status = this.mapErrorStatus(result.value);
      this.logger.warn(`Event search failed: ${result.value.message}`);
      res.status(status);
      res.render("events/partials/list", {
        pageError: result.value.message,
        events: [],
        session,
        query,
      });
      return;
    }

    res.render("events/partials/list", {
      pageError: null,
      events: result.value,
      session,
      query,
    });
  }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}
