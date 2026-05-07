// Feature 12 — Attendee List
// Controller: parses request, calls service, maps Result to HTTP response.
// No business logic lives here.

import type { Response } from "express";
import type { IAttendeeListService } from "../service/AttendeeListService";
import type { ILoggingService } from "../service/LoggingService";
import type { AttendeeListError } from "../AttendeeListErrors";
import type { IAppBrowserSession } from "../session/AppSession";

export interface IAttendeeListController {
  showAttendees(
    res: Response,
    eventId: number,
    requestingUserId: string,
    requestingUserRole: string,
    eventTitle: string,
    browserSession: IAppBrowserSession,
    isHtmx?: boolean,
  ): Promise<void>;
}

class AttendeeListController implements IAttendeeListController {
  constructor(
    private readonly service: IAttendeeListService,
    private readonly logger: ILoggingService,
  ) {}

  async showAttendees(
    res: Response,
    eventId: number,
    requestingUserId: string,
    requestingUserRole: string,
    eventTitle: string,
    browserSession: IAppBrowserSession,
    isHtmx: boolean = false,
  ): Promise<void> {
    this.logger.info(`GET /events/${eventId}/attendees by user ${requestingUserId}`);

    const result = await this.service.getGroupedAttendees(eventId, requestingUserId, requestingUserRole);

    if (!result.ok) {
      const err = result.value as AttendeeListError;
      const status = err.name === "EventNotFound" ? 404 : 403;
      res.status(status).render("partials/error", { message: err.message, layout: false });
      return;
    }

    // HTMX requests get the bare partial so it can be swapped inline; direct
    // browser navigation to /events/:id/attendees still renders with the
    // full layout so the page stands on its own. The `compact` flag tells
    // the template to drop its redundant title block when nested inside
    // the event detail page (which already shows the event title).
    const renderOptions: Record<string, unknown> = {
      eventId,
      eventTitle,
      grouped: result.value,
      session: browserSession,
      compact: isHtmx,
    };
    if (isHtmx) {
      renderOptions.layout = false;
    }
    res.render("rsvp/attendees", renderOptions);
  }
}

export function CreateAttendeeListController(
  service: IAttendeeListService,
  logger: ILoggingService,
): IAttendeeListController {
  return new AttendeeListController(service, logger);
}
