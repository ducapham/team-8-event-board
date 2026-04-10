import { Result } from "../lib/result.js";
import {RVSPError, SearchError} from "../lib/errors.js";

export interface IEventService {
    Toggle(eventId: number, userId: string): Promise<Result<string, RVSPError>>;
    Search(query: string): Promise<Result<string[], SearchError>>;
}

class EventService implements IEventService {
    constructor(private readonly repo: IEventRepository) {}

    async Toggle(eventId: number, userId: string): Promise<Result<string, RVSPError>> {
        const status = await this.repo.getStatus(eventId, userId);
        const capacity = await this.repo.getCapacity(eventId);
        const currentAttendees = await this.repo.getAttendees(eventId);
        if(status == "Not Registered" && capacity == currentAttendees.length) {
            await this.repo.makeWaitlist(eventId, userId);
            return { ok: true, value: "Waitlisted"};
        }
        else if(status == "Not Registered" && capacity > currentAttendees.length) {
            await this.repo.registerUser(eventId, userId);
            return { ok: true, value: "Registered"};
        }
        else if(status == "Registered") {
            await this.repo.makeCancelled(eventId, userId);
            return { ok: true, value: "Cancelled"};
        }
        return { ok: false, value: new RVSPError("Failed to toggle event") };
    }

    async Search(query: string): Promise<Result<string[], SearchError>> {
        const results = await this.repo.searchEvents(query);
        return { ok: true, value: results };
    }
    
}
