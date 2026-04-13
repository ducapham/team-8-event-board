import type { IUserRecord } from "./auth/User.js";

export interface IEvent{
    id: number;
    title: string;
    description: string;
    location: string;
    category: string;
    date: Date;
    time: string;
    organizerID: number;
    attendees: IUserRecord[];
    waitlist: IUserRecord[];
    capacity: number;
}

export interface IEventSummary {
    id: number;
    date: Date;
    time: string;
    status: "Registered" | "Waitlisted";
    Event: IEvent;
    User: IUserRecord;
}