import request from "supertest";
import type { Express } from "express";
import { createExposedApp } from "../ExposedComposition";
import { IEventRepository } from "../../src/repository/EventRepository";
import { ICommentRepository } from "../../src/repository/CommentRepository";

// Update this constant if your EventController mounts the search route differently.
const SEARCH_PATH = "/events/search";

const READER_EMAIL = "user@app.test";
const READER_PASSWORD = "password123";
const STAFF_EMAIL = "staff@app.test";
const STAFF_PASSWORD = "password123";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExpressApp(): { app: Express; eventRepository: IEventRepository; commentRepository: ICommentRepository } {
  const { app, eventRepository, commentRepository } = createExposedApp();
  const expressApp = (app as unknown as { getExpressApp(): Express }).getExpressApp();
  return { app: expressApp, eventRepository, commentRepository };
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

async function search(
  agent: ReturnType<typeof request.agent>,
  query: string,
) {
  return agent
    .get(SEARCH_PATH)
    .query({ query: query }) 
    .set("HX-Request", "true");
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe(`GET ${SEARCH_PATH} — integration`, () => {
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
      .get(SEARCH_PATH)
      .query({ q: "picnic" })
      .set("HX-Request", "true")
      .expect(401);
  });

  // ── Empty query → full upcoming list ────────────────────────────────────

  it("returns all published upcoming events when the query is empty", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await search(agent, "");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Community Picnic");
    expect(res.text).toContain("Startup Pitch Night");
    expect(res.text).toContain("Neighborhood Social Mixer");
    expect(res.text).toContain("Weekend Art Walk");
    expect(res.text).toContain("Park Cleanup Drive");
  });

  it("does not include past events when the query is empty", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await search(agent, "");

    expect(res.status).toBe(200);
    // id 105 — Spring Music Festival ended in 2024.
    expect(res.text).not.toContain("Spring Music Festival");
  });

  it("does not include draft events when the user is not the organizer", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await search(agent, "");

    expect(res.status).toBe(200);
    // id 103 — Accessibility Workshop is a draft owned by user-staff.
    expect(res.text).not.toContain("Accessibility Workshop");
  });

  // ── Title match ──────────────────────────────────────────────────────────

  it("returns events whose title contains the query (case-insensitive)", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await search(agent, "picnic"); // lowercase vs "Community Picnic"

    expect(res.status).toBe(200);
    expect(res.text).toContain("Community Picnic");
    expect(res.text).not.toContain("Startup Pitch Night");
  });

  // ── Location match ───────────────────────────────────────────────────────

  it("returns events whose location contains the query", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await search(agent, "Riverside Park");

    expect(res.status).toBe(200);
    // id 1 — Community Picnic is at Riverside Park.
    expect(res.text).toContain("Community Picnic");
  });

  // ── Description match ────────────────────────────────────────────────────

  it("returns events whose description contains the query", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    // "investors" only appears in Startup Pitch Night's description.
    const res = await search(agent, "investors");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Startup Pitch Night");
    expect(res.text).not.toContain("Community Picnic");
  });

  // ── Category match ───────────────────────────────────────────────────────

  it("returns only events whose category matches the query", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await search(agent, "volunteer");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Park Cleanup Drive");
    // Community Picnic is Social, not Volunteer.
    expect(res.text).not.toContain("Community Picnic");
  });

  // ── No match ─────────────────────────────────────────────────────────────

  it("returns an empty result when no event matches the query", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await search(agent, "xyznonexistentterm");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("Community Picnic");
    expect(res.text).not.toContain("Startup Pitch Night");
    expect(res.text).not.toContain("Park Cleanup Drive");
  });

  // ── Past event exclusion ─────────────────────────────────────────────────

  it("excludes past events even when the query matches their title", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    // "Spring Music Festival" matches id 105 (2024 — past).
    const res = await search(agent, "Spring Music Festival");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("Spring Music Festival");
  });

  // ── Draft visibility ─────────────────────────────────────────────────────

  it("includes the organizer's own draft when they are the viewer", async () => {
    // id 103 — Accessibility Workshop is a draft owned by user-staff.
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);

    const res = await search(agent, "Accessibility");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Accessibility Workshop");
  });

  it("excludes a draft when the logged-in user is not the organizer", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await search(agent, "Accessibility");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("Accessibility Workshop");
  });
});