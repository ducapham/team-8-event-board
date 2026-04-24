// Feature 12 — Attendee List: HTTP contract tests
//
// Covers:
//   - happy path: admin sees grouped attendee list for an event
//   - grouping/sorting: correct counts per status, DOM order within sections
//   - 404 EventNotFound when the event doesn't exist
//   - 403 Unauthorized for a non-organizer non-admin user
//   - 302 redirect to /login for unauthenticated requests
//   - empty-state edge case: event exists but has zero RSVPs
//
// Note: after the Sprint 2 repository refactor the in-memory summary starts
// empty (no seed RSVPs), so each test that needs attendees creates its own
// state via the existing POST /events/:id/toggle endpoint before asserting.

import request from "supertest";
import type { Express } from "express";
import { createComposedApp } from "../../src/composition";
import type { ILoggingService } from "../../src/service/LoggingService";

function makeSilentLogger(): ILoggingService {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as ILoggingService;
}

async function loginAs(
  app: Express,
  email: string,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const response = await agent
    .post("/login")
    .type("form")
    .send({ email, password: "password123" });
  expect(response.status).toBe(302);
  return agent;
}

// Helper: POST to the RSVP toggle endpoint as an HTMX request so the server
// returns 200 instead of a redirect. Used to seed attendee state.
async function toggleRsvp(
  agent: ReturnType<typeof request.agent>,
  eventId: number,
): Promise<void> {
  const res = await agent
    .post(`/events/${eventId}/toggle`)
    .set("HX-Request", "true");
  expect(res.status).toBe(200);
}

describe("Feature 12 — Attendee List HTTP contracts", () => {
  let app: Express;

  beforeEach(() => {
    app = createComposedApp(makeSilentLogger()).getExpressApp();
  });

  describe("GET /events/:id/attendees", () => {
    it("happy path: an admin sees the grouped attendee list for an event", async () => {
      // Seed: user-reader (Una User) RSVPs to event 1. Event 1 has capacity 50
      // so this toggle lands in the Registered/Going group.
      const reader = await loginAs(app, "user@app.test");
      await toggleRsvp(reader, 1);

      // Event 1's organizerId is "user-admin"; admin@app.test has role "admin",
      // so either the organizer rule or the admin rule lets them through.
      const admin = await loginAs(app, "admin@app.test");
      const response = await admin.get("/events/1/attendees");

      expect(response.status).toBe(200);
      // Event title and the three group headings should be on the page.
      expect(response.text).toContain("Community Picnic");
      expect(response.text).toContain("Going");
      expect(response.text).toContain("Waitlisted");
      expect(response.text).toContain("Cancelled");
      // user-reader's display name should appear in the Going section.
      expect(response.text).toContain("Una User");
    });

    it("groups attendees by status with correct counts", async () => {
      // Course Sprint 2 rubric calls out: "the grouping and sorting are correct".
      //
      // Event 102 has capacity 1, so the first toggle lands in Going and the
      // second toggle lands in Waitlisted. This gives us one attendee per
      // non-empty group without needing any seed data.
      const reader = await loginAs(app, "user@app.test"); // Una User -> Going
      await toggleRsvp(reader, 102);

      const staff = await loginAs(app, "staff@app.test"); // Sam Staff -> Waitlisted
      await toggleRsvp(staff, 102);

      const admin = await loginAs(app, "admin@app.test");
      const response = await admin.get("/events/102/attendees");

      expect(response.status).toBe(200);
      expect(response.text).toMatch(/Going\s*\(1\)/);
      expect(response.text).toMatch(/Waitlisted\s*\(1\)/);
      expect(response.text).toMatch(/Cancelled\s*\(0\)/);

      // Grouping check: Una User must appear inside the "Going" section, and
      // Sam Staff inside "Waitlisted" — i.e. the "Going" heading must come
      // before "Una User", which must come before the "Waitlisted" heading,
      // which must come before "Sam Staff".
      const goingIdx = response.text.search(/Going\s*\(/);
      const unaIdx = response.text.indexOf("Una User");
      const waitlistedIdx = response.text.search(/Waitlisted\s*\(/);
      const samIdx = response.text.indexOf("Sam Staff");

      expect(goingIdx).toBeGreaterThan(-1);
      expect(unaIdx).toBeGreaterThan(goingIdx);
      expect(waitlistedIdx).toBeGreaterThan(unaIdx);
      expect(samIdx).toBeGreaterThan(waitlistedIdx);
    });

    it("returns 404 when the event doesn't exist (EventNotFound)", async () => {
      const agent = await loginAs(app, "admin@app.test");

      const response = await agent.get("/events/9999/attendees");

      expect(response.status).toBe(404);
      expect(response.text).toContain("Event 9999 was not found.");
    });

    it("returns 403 for a user who is neither the organizer nor an admin (Unauthorized)", async () => {
      // user-reader is not the organizer of event 1 and is not an admin.
      const agent = await loginAs(app, "user@app.test");

      const response = await agent.get("/events/1/attendees");

      expect(response.status).toBe(403);
      expect(response.text).toContain(
        "Only the event organizer or an admin may view the attendee list.",
      );
    });

    it("edge case: an event with no RSVPs renders empty-state messaging", async () => {
      // Event 101 exists but has no RSVPs seeded or created during this test.
      // An admin should see the page render successfully with the
      // "No attendees in this group" message.
      const agent = await loginAs(app, "admin@app.test");

      const response = await agent.get("/events/101/attendees");

      expect(response.status).toBe(200);
      expect(response.text).toContain("No attendees in this group.");
    });

    it("redirects unauthenticated GETs to /login", async () => {
      const response = await request(app).get("/events/1/attendees");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });
  });
});
