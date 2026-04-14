import { Event } from "./Event";
import { EventRepository } from "./EventRepository";

export class InMemoryEventRepository implements EventRepository {
  private readonly events = new Map<string, Event>();

  async create(event: Event): Promise<Event> {
    this.events.set(event.id, event);
    return event;
  }

  async findById(id: string): Promise<Event | null> {
    return this.events.get(id) ?? null;
  }
}