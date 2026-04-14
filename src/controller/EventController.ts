import type { Response, Request } from "express";
import type { IAppBrowserSession } from "../session/AppSession.js";
import type { IEvent } from "../event.js";
import type { EventError } from "../lib/errors.js";
import type { IEventService } from "../service/EventService.js";
import type { ILoggingService } from "../service/LoggingService.js";
import type { Result } from "../lib/result.js";
import { getAuthenticatedUser, touchAppSession } from "../session/AppSession";

export interface IEventController {
  showEvents(res: Response, session: IAppBrowserSession, pageError?: string | null): Promise<void>;
  toggleFromForm(res: Response, eventId: number, session: IAppBrowserSession): Promise<void>;
  searchFromHtmx(res: Response, query: string, session: IAppBrowserSession): Promise<void>;
  renderCreateForm(req: Request, res: Response): void;
  createEvent(req: Request, res: Response): Promise<void>;
  getEventDetail(req: Request, res: Response): Promise<void>;
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
    if (error.name === "EventNotFoundError") return 404;
    if (error.name === "UserNotFoundError") return 404;
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

    const result = await this.service.getEventById(eventId, viewerId);

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
      event: result.value,
      session: browserSession,
      pageError: null,
    });
    }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}
