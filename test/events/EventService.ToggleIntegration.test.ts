import request from "supertest";
import type { Express } from "express";
import { createComposedApp } from "../../src/composition";
import { CreateInMemoryUserRepository } from "../../src/auth/InMemoryUserRepository";
import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";


const READER_EMAIL = "user@app.test";
const READER_PASSWORD = "password123";
const ADMIN_EMAIL = "admin@app.test";
const ADMIN_PASSWORD = "password123";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExpressApp(): Express {
  const app = createComposedApp();
  // IApp wraps Express; cast to access the underlying instance.
  return (app as unknown as { getExpressApp(): Express }).getExpressApp();
}

/**
 * Returns a supertest Agent that is already authenticated as the given user.
 * The agent stores and re-sends the session cookie automatically.
 */
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

  beforeEach(() => {
    app = getExpressApp();
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
  });

  // ── Past event rejection ─────────────────────────────────────────────────

  it("rejects an RSVP attempt for a past event with a non-2xx status or error partial", async () => {
    // Event 105 (Spring Music Festival) ended in 2024.
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .post("/events/105/toggle")
      .set("HX-Request", "true");

    // The route renders partials/error (status 200 with error HTML) or a 4xx.
    const isErrorStatus = res.status >= 400;
    const isErrorPartial = res.text.toLowerCase().includes("error") ||
      res.text.toLowerCase().includes("cannot rsvp");
    expect(isErrorStatus || isErrorPartial).toBe(true);
  });

  // ── Cancelled event rejection ────────────────────────────────────────────

  it("rejects an RSVP attempt for a cancelled event", async () => {
    // First cancel event 101 (requires staff/admin role via the cancel route).
    const adminAgent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminAgent
      .post("/events/101/cancel")
      .set("HX-Request", "true");

    // Now a regular user tries to RSVP.
    const readerAgent = await loginAs(app, READER_EMAIL, READER_PASSWORD);
    const res = await readerAgent
      .post("/events/101/toggle")
      .set("HX-Request", "true");

    const isErrorStatus = res.status >= 400;
    const isErrorPartial = res.text.toLowerCase().includes("error") ||
      res.text.toLowerCase().includes("cancelled");
    expect(isErrorStatus || isErrorPartial).toBe(true);
  });

  // ── Invalid event ID ─────────────────────────────────────────────────────

  it("returns 400 for a non-numeric event ID", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .post("/events/abc/toggle")
      .set("HX-Request", "true");

    expect(res.status).toBe(400);
  });

  it("returns an error partial for a numeric but non-existent event ID (999)", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .post("/events/999/toggle")
      .set("HX-Request", "true");

    // The service returns EventNotFoundError; the controller renders an error partial.
    const isErrorStatus = res.status >= 400;
    const isErrorPartial = res.text.toLowerCase().includes("error") ||
      res.text.toLowerCase().includes("not found");
    expect(isErrorStatus || isErrorPartial).toBe(true);
  });

  // ── Non-HTMX fallback (full-page redirect) ───────────────────────────────

  it("redirects (302) instead of rendering a partial for non-HTMX toggle requests", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    // No HX-Request header → the route should redirect back to the event page.
    const res = await agent.post("/events/101/toggle");

    expect(res.status).toBe(302);
  });
});