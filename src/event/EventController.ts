import { Request, Response } from "express";
import { getAuthenticatedUser, touchAppSession } from "../session/AppSession";
import { EventService } from "./EventService";

export class EventController {
  constructor(private readonly eventService: EventService) {}

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

    const result = await this.eventService.createEvent(
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

    const result = await this.eventService.getEventById(eventId, viewerId);

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