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
  ): Promise<void> {
    this.logger.info(`GET /events/${eventId}/attendees by user ${requestingUserId}`);

    const result = await this.service.getGroupedAttendees(eventId, requestingUserId, requestingUserRole);

    if (!result.ok) {
      const err = result.value as AttendeeListError;
      const status = err.name === "EventNotFound" ? 404 : 403;
      res.status(status).render("partials/error", { message: err.message, layout: false });
      return;
    }

    res.render("rsvp/attendees", {
      eventId,
      eventTitle,
      grouped: result.value,
      session: browserSession,
    });
  }
}

export function CreateAttendeeListController(
  service: IAttendeeListService,
  logger: ILoggingService,
): IAttendeeListController {
  return new AttendeeListController(service, logger);
}
