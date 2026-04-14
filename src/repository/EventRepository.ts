import type { IEvent } from "../event.js";
import type { Result } from "../lib/result.js";
import type { EventError } from "../lib/errors.js";

export interface IEventRepository {
  listEvents(): Promise<Result<IEvent[], EventError>>;
  findById(id: number): Promise<Result<IEvent | null, EventError>>;
  save(event: IEvent): Promise<Result<IEvent, EventError>>;
  toggleRVSP(eventId: number, userId: string): Promise<Result<string, EventError>>;
  searchEvents(query: string): Promise<IEvent[]>;
  create(event: IEvent): Promise<IEvent>;
}

