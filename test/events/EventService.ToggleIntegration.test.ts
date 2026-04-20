import request from "supertest";
import type { Express } from "express";
import { createExposedApp } from "./ExposedComposition";
import { IEventRepository } from "../../src/repository/EventRepository";
import { ICommentRepository } from "../../src/repository/CommentRepository";


const READER_EMAIL = "user@app.test";
const READER_PASSWORD = "password123";
const ADMIN_EMAIL = "admin@app.test";
const ADMIN_PASSWORD = "password123";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExpressApp(): {app: Express, eventRepository:IEventRepository, commentRepository: ICommentRepository} {
  const {app, eventRepository, commentRepository} = createExposedApp();
  const expressApp = (app as unknown as { getExpressApp(): Express }).getExpressApp();
  return {app: expressApp, eventRepository, commentRepository};
}

async function loginAs(
  app: Express,
  email: string,
  password: string,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  await agent
    .post("/login")
    .type("form")
    .send({ email, password })
    .expect((res) => {
      // Accept both a redirect (302) and an immediate render (200).
      if (res.status !== 302 && res.status !== 200) {
        throw new Error(`Login failed with status ${res.status}`);
      }
    });
  return agent;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("POST /events/:id/toggle — integration", () => {
  let app: Express;
  let eventRepository: IEventRepository;
  let commentRepository: ICommentRepository;
  beforeEach(() => {
    const exposed = getExpressApp();
    app = exposed.app;
    eventRepository = exposed.eventRepository;
    commentRepository = exposed.commentRepository;
  });

  // ── Authentication guard ─────────────────────────────────────────────────

  it("returns 401 when the user is not authenticated", async () => {
    await request(app)
      .post("/events/101/toggle")
      .set("HX-Request", "true")
      .expect(401);
  });


  it("registers the user as an attendee when the event has capacity", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    // Act: toggle RSVP for event 101 (Neighborhood Social Mixer, cap 40).
    const res = await agent
      .post("/events/101/toggle")
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    const ToggleResult = await eventRepository.findById(101);
    expect(ToggleResult.ok).toBe(true);
    if(ToggleResult.ok && ToggleResult.value) {
      const event = ToggleResult.value;
      expect(event.attendees.some(a => a.id === "user-reader")).toBe(true);
    }
    expect(res.text).not.toContain("error"); // partial renders error on failure
  });


  it("places a second user on the waitlist when the event is at capacity", async () => {
    const readerAgent = await loginAs(app, READER_EMAIL, READER_PASSWORD);
    const adminAgent  = await loginAs(app, ADMIN_EMAIL,  ADMIN_PASSWORD);

    const firstRes = await readerAgent
      .post("/events/102/toggle")
      .set("HX-Request", "true");
    expect(firstRes.status).toBe(200);

    const secondRes = await adminAgent
      .post("/events/102/toggle")
      .set("HX-Request", "true");
    expect(secondRes.status).toBe(200);
    const ToggleResult = await eventRepository.findById(102);
    expect(ToggleResult.ok).toBe(true);
    if(ToggleResult.ok && ToggleResult.value) {
      const event = ToggleResult.value;
      expect(event.attendees).toHaveLength(1);
      expect(event.attendees[0].id).toBe("user-reader");
      expect(event.waitlist).toHaveLength(1);
      expect(event.waitlist[0].id).toBe("user-admin");
    }
    expect(secondRes.text).not.toContain("error");
  });

  // ── Cancellation: toggling an active RSVP ────────────────────────────────

  it("cancels the RSVP when the user toggles a second time", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    // First toggle → register.
    const registerRes = await agent
      .post("/events/101/toggle")
      .set("HX-Request", "true");
    expect(registerRes.status).toBe(200);

    // Second toggle → cancel.
    const cancelRes = await agent
      .post("/events/101/toggle")
      .set("HX-Request", "true");
    expect(cancelRes.status).toBe(200);
    const ToggleResult = await eventRepository.findById(101);
    expect(ToggleResult.ok).toBe(true);
    if(ToggleResult.ok && ToggleResult.value) {
      const event = ToggleResult.value;
      expect(event.attendees.some(a => a.id === "user-reader")).toBe(false);
    }
    expect(cancelRes.text).not.toContain("error");
  });

  // ── Re-registration after cancellation ───────────────────────────────────

  it("re-registers the user after they cancelled (toggle × 3)", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    // register → cancel → re-register
    for (let i = 0; i < 3; i++) {
      const res = await agent
        .post("/events/101/toggle")
        .set("HX-Request", "true");
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("error");
    }
    const ToggleResult = await eventRepository.findById(101);
    expect(ToggleResult.ok).toBe(true);
    if(ToggleResult.ok && ToggleResult.value) {
      const event = ToggleResult.value;
      expect(event.attendees.some(a => a.id === "user-reader")).toBe(true);
    }
  });

  // ── Past event rejection ─────────────────────────────────────────────────

  it("rejects an RSVP attempt for a past event with a non-2xx status or error partial", async () => {
    // Event 105 (Spring Music Festival) ended in 2024.
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .post("/events/105/toggle")
      .set("HX-Request", "true");

    // The route renders partials/error (status 200 with error HTML) or a 4xx.
    expect (res.status).toBe(403);
  });

  // ── Cancelled event rejection ────────────────────────────────────────────

  it("rejects an RSVP attempt for a cancelled event", async () => {
    // First cancel event 101 (requires staff/admin role via the cancel route).
    const adminAgent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminAgent
      .post("/events/101/cancel")
      .set("HX-Request", "true");

    const readerAgent = await loginAs(app, READER_EMAIL, READER_PASSWORD);
    const res = await readerAgent
      .post("/events/101/toggle")
      .set("HX-Request", "true");

    expect(res.status).toBe(403);
  });

  // ── Non-existent event rejection ─────────────────────────────────────────
  it("rejects an RSVP attempt for a non-existent event", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);
    const res = await agent
      .post("/events/999/toggle")
      .set("HX-Request", "true");
    expect(res.status).toBe(404);
  });
  // ── Non-HTMX fallback (full-page redirect) ───────────────────────────────

  it("redirects (302) instead of rendering a partial for non-HTMX toggle requests", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    // No HX-Request header → the route should redirect back to the event page.
    const res = await agent.post("/events/101/toggle");

    expect(res.status).toBe(302);
  });
});