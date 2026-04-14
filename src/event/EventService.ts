import { Err, Ok, Result } from "../lib/result";
import { Event } from "./Event";
import { EventRepository } from "./EventRepository";
import {
  CreateEventError,
  GetEventError,
  InvalidInputError,
  EventNotFoundError,
  ForbiddenError,
} from "./EventErrors";

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  category: string;
  capacity?: number;
  startDatetime: string;
  endDatetime: string;
}

export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  async createEvent(
    input: CreateEventInput,
    organizerId: string,
  ): Promise<Result<Event, CreateEventError>> {
    if (!organizerId.trim()) {
      return Err(new InvalidInputError("Organizer ID is required"));
    }

    if (!input.title.trim()) {
      return Err(new InvalidInputError("Title is required"));
    }

    if (!input.description.trim()) {
      return Err(new InvalidInputError("Description is required"));
    }

    if (!input.location.trim()) {
      return Err(new InvalidInputError("Location is required"));
    }

    if (!input.category.trim()) {
      return Err(new InvalidInputError("Category is required"));
    }

    const startDatetime = new Date(input.startDatetime);
    const endDatetime = new Date(input.endDatetime);

    if (
      Number.isNaN(startDatetime.getTime()) ||
      Number.isNaN(endDatetime.getTime())
    ) {
      return Err(new InvalidInputError("Start and end times must be valid"));
    }

    if (endDatetime <= startDatetime) {
      return Err(new InvalidInputError("End time must be after start time"));
    }

    if (
      input.capacity !== undefined &&
      (!Number.isInteger(input.capacity) || input.capacity <= 0)
    ) {
      return Err(new InvalidInputError("Capacity must be a positive integer"));
    }

    const now = new Date();
    const event: Event = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      category: input.category.trim(),
      status: "draft",
      capacity: input.capacity,
      startDatetime,
      endDatetime,
      organizerId,
      createdAt: now,
      updatedAt: now,
    };

    const createdEvent = await this.eventRepository.create(event);
    return Ok(createdEvent);
  }

  async getEventById(
    eventId: string,
    viewerId?: string,
  ): Promise<Result<Event, GetEventError>> {
    const event = await this.eventRepository.findById(eventId);

    if (!event) {
      return Err(new EventNotFoundError("Event not found"));
    }

    if (event.status === "draft" && event.organizerId !== viewerId) {
      return Err(new ForbiddenError("Draft event not accessible"));
    }

    return Ok(event);
  }
}