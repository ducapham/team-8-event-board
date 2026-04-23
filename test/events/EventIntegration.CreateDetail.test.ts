import request from "supertest";
import type { Express } from "express";
import { createExposedApp } from "../ExposedComposition";

const READER_EMAIL = "user@app.test";
const READER_PASSWORD = "password123";
const STAFF_EMAIL = "staff@app.test";
const STAFF_PASSWORD = "password123";

function getExpressApp(): Express {
  const { app } = createExposedApp();
  return (app as unknown as { getExpressApp(): Express }).getExpressApp();
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
      if (res.status !== 302 && res.status !== 200) {
        throw new Error(`Login failed with status ${res.status}`);
      }
    });

  return agent;
}

describe("Event Creation + Detail integration", () => {
  let app: Express;

  beforeEach(() => {
    app = getExpressApp();
  });

  // ── /events/new ──────────────────────────────────────────────────────────

  it("redirects unauthenticated users from GET /events/new to /login", async () => {
    const res = await request(app).get("/events/new");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("renders the create event page for an authenticated user", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent.get("/events/new");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Create Event");
    expect(res.text).toContain('name="title"');
    expect(res.text).toContain('name="description"');
  });

  // ── POST /events ────────────────────────────────────────────────────────

  it("creates an event successfully and redirects to its detail page", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .post("/events")
      .type("form")
      .send({
        title: "Integration Test Event",
        description: "Created through integration test",
        location: "Campus Center",
        category: "Social",
        capacity: "10",
        startDatetime: "2026-04-20T10:00",
        endDatetime: "2026-04-20T12:00",
      });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/events\/.+$/);
  });

  it("returns 400 when invalid input is submitted", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .post("/events")
      .type("form")
      .send({
        title: "Bad Integration Event",
        description: "Bad datetime ordering",
        location: "Campus Center",
        category: "Social",
        capacity: "10",
        startDatetime: "2026-04-20T12:00",
        endDatetime: "2026-04-20T10:00",
      });

    expect(res.status).toBe(400);
    expect(res.text).toContain("End time must be after start time");
  });

  it("blocks unauthenticated users from creating events", async () => {
    const res = await request(app)
      .post("/events")
      .type("form")
      .send({
        title: "Blocked Event",
        description: "Should not be created",
        location: "Campus Center",
        category: "Social",
        capacity: "10",
        startDatetime: "2026-04-20T10:00",
        endDatetime: "2026-04-20T12:00",
      });

    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue.");
  });

  // ── GET /events/:id happy path ──────────────────────────────────────────

  it("renders the detail page after creating an event", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const createRes = await agent
      .post("/events")
      .type("form")
      .send({
        title: "Created Then Viewed",
        description: "Detail page integration test",
        location: "Student Union",
        category: "Academic",
        capacity: "5",
        startDatetime: "2026-04-21T10:00",
        endDatetime: "2026-04-21T12:00",
      });

    expect(createRes.status).toBe(302);
    const detailPath = createRes.headers.location;
    expect(detailPath).toMatch(/^\/events\/.+$/);

    const detailRes = await agent.get(detailPath);

    expect(detailRes.status).toBe(200);
    expect(detailRes.text).toContain("Created Then Viewed");
    expect(detailRes.text).toContain("Detail page integration test");
    expect(detailRes.text).toContain("Student Union");
    expect(detailRes.text).toContain("Draft");
  });

  // ── GET /events/:id failures ────────────────────────────────────────────

  it("returns 404 when the event id does not exist", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent.get("/events/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.text).toContain("Event not found");
  });

  it("returns 403 when a different authenticated user tries to view a draft event", async () => {
    const ownerAgent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const createRes = await ownerAgent
      .post("/events")
      .type("form")
      .send({
        title: "Private Draft Event",
        description: "Only organizer should see this",
        location: "Library",
        category: "Study",
        capacity: "8",
        startDatetime: "2026-04-22T10:00",
        endDatetime: "2026-04-22T12:00",
      });

    expect(createRes.status).toBe(302);
    const detailPath = createRes.headers.location;
    expect(detailPath).toMatch(/^\/events\/.+$/);

    const otherAgent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await otherAgent.get(detailPath);

    expect(res.status).toBe(403);
    expect(res.text).toContain("You do not have access to this event.");
  });

  it("allows the organizer to view their own draft event", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const createRes = await agent
      .post("/events")
      .type("form")
      .send({
        title: "Organizer Draft Event",
        description: "Organizer should be allowed",
        location: "Campus Center",
        category: "Social",
        capacity: "6",
        startDatetime: "2026-04-23T10:00",
        endDatetime: "2026-04-23T12:00",
      });

    expect(createRes.status).toBe(302);
    const detailPath = createRes.headers.location;

    const res = await agent.get(detailPath);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Organizer Draft Event");
  });
});