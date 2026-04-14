import { Ok, type Result } from "../lib/result.js";
import type { IEventRepository } from "../repository/EventRepository.js";
import type { IEvent } from "../event.js";
import { EventError, UnknownError } from "../lib/errors.js";

export interface IEventService {
    Toggle(eventId: number, userId: string): Promise<Result<string, EventError>>;
    Search(query: string): Promise<Result<IEvent[], EventError>>;
}

class EventService implements IEventService {
    private searchTimeout: NodeJS.Timeout | undefined;
    private pendingSearchPromise: Promise<Result<IEvent[], EventError>> | null = null;
    private pendingSearchResolver: ((value: Result<IEvent[], EventError>) => void) | null = null;
    private latestSearchQuery = "";
    private readonly searchDelayMs = 250;

    constructor(private readonly repo: IEventRepository) {}

    async Toggle(eventId: number, userId: string): Promise<Result<string, EventError>> {
        const result = await this.repo.toggleRVSP(eventId, userId);
        if (!result.ok) {
            return result;
        }
        return { ok: true, value: "RSVP updated" };
    }

    async Search(query: string): Promise<Result<IEvent[], EventError>> {
        this.latestSearchQuery = query;

        if (this.pendingSearchPromise) {
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }
            this.searchTimeout = setTimeout(() => this.executePendingSearch(), this.searchDelayMs);
            return this.pendingSearchPromise;
        }

        this.pendingSearchPromise = new Promise((resolve) => {
            this.pendingSearchResolver = resolve;
            this.searchTimeout = setTimeout(() => this.executePendingSearch(), this.searchDelayMs);
        });

        return this.pendingSearchPromise;
    }

    private async executePendingSearch(): Promise<void> {
        if (!this.pendingSearchResolver) {
            return;
        }

        const resolver = this.pendingSearchResolver;
        const query = this.latestSearchQuery;

        this.searchTimeout = undefined;
        this.pendingSearchPromise = null;
        this.pendingSearchResolver = null;

        try {
            const results = await this.repo.searchEvents(query);
            resolver({ ok: true, value: results });
        } catch {
            resolver({ ok: false, value: UnknownError("Search failed") });
        }
    }
}
export function CreateEventService(repo: IEventRepository): IEventService {
    return new EventService(repo);
}
