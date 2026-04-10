import { Result } from "../lib/result.js";
import {RVSPError, SearchError} from "../lib/errors.js";

export type Event = {
    id: number;
    title: string;
    description: string;
    location: string;
    category: string;
    date: Date;
    time: string;
    organizerID: number;
    attendees: number;
    capacity: number;
}

export type CreateEvent = {
    title: string;
    description: string;
    location: string;
    category: string;
    date: Date;
    time: string;
    capacity: number;
}

export interface IEventRepository {
    getStatus(eventId: number, userId: string): Promise<string>;
    getCapacity(eventId: number): Promise<number>;
    getAttendees(eventId: number): Promise<string[]>;
    makeWaitlist(eventId: number, userId: string): Promise<void>;
    registerUser(eventId: number, userId: string): Promise<void>;
    makeCancelled(eventId: number, userId: string): Promise<void>;
    searchEvents(query: string): Promise<string[]>;
}

