import type { IEvent} from "../event";
import type { Result } from "../lib/result.js";
import type { EventError } from "../lib/errors";

export type CreateEvent = {
  title: string;
  description: string;
  location: string;
  category: string;
  date: Date;
  time: string;
  capacity: number;
};

export interface IEventRepository {
  toggleRVSP(eventId: number, userId: string): Promise<Result<string, EventError>> ;
  searchEvents(query: string): Promise<IEvent[]>;
}

