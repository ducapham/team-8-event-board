import type { IUserRecord } from "./auth/User.js";

export type EventStatus = "draft" | "published" | "cancelled" | "past";

export interface IEvent{
    id: number;
    title: string;
    description: string;
    location: string;
    category: string;
    date: Date;
    time: string;
    organizerId: string;
    startDatetime: Date;
    endDatetime: Date;  
    attendees: IUserRecord[];
    waitlist: IUserRecord[];
    capacity?: number;
    createdAt: Date;
    updatedAt: Date;
    status: EventStatus;
}

export interface IEventSummary {
    id: number;
    date: Date;
    time: string;
    status: "Registered" | "Waitlisted";
    Event: IEvent;
    User: IUserRecord;
}