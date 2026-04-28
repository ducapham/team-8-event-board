import request from "supertest";
import type { Express } from "express";
import { createLifecyclePrismaExposedApp } from "../ExposedComposition";
import { IEventRepository } from "../../src/repository/EventRepository";

const READER_EMAIL = "user@app.test";
const READER_PASSWORD = "password123";
const STAFF_EMAIL = "staff@app.test";
const STAFF_PASSWORD = "password123";
const ADMIN_EMAIL = "admin@app.test";
const ADMIN_PASSWORD = "password123";

function getExpressApp(): { app: Express; eventRepository: IEventRepository } {
  const { app, eventRepository } = createLifecyclePrismaExposedApp();
  const expressApp = (app as unknown as { getExpressApp(): Express }).getExpressApp();
  return { app: expressApp, eventRepository };
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

describe("Feature 5 lifecycle endpoints — integration", () => {
  let app: Express;
  let eventRepository: IEventRepository;

  beforeEach(() => {
    const exposed = getExpressApp();
    app = exposed.app;
    eventRepository = exposed.eventRepository;
  });

  it("returns 401 when publish is requested without authentication", async () => {
    const res = await request(app)
      .post("/events/103/publish")
      .set("HX-Request", "true");

    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue.");
  });

  it("publishes a draft event for the organizer and returns the HTMX detail fragment", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);

    const res = await agent
      .post("/events/103/publish")
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).toContain("event-detail-shell");
    expect(res.text).toContain("Published");
    expect(res.text).toContain("Cancel Event");

    const eventResult = await eventRepository.findById(103);
    expect(eventResult.ok).toBe(true);
    if (eventResult.ok && eventResult.value) {
      expect(eventResult.value.status).toBe("published");
    }
  });

  it("returns 403 when a non-owner tries to publish a draft event", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .post("/events/103/publish")
      .set("HX-Request", "true");

    expect(res.status).toBe(403);
    expect(res.text).toContain("Only the organizer or an admin can publish this event.");
  });

  it("returns 409 when trying to publish an already published event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);

    const res = await agent
      .post("/events/101/publish")
      .set("HX-Request", "true");

    expect(res.status).toBe(409);
    expect(res.text).toContain("Only draft events can be published.");
  });

  it("redirects after a successful non-HTMX publish request", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);

    const res = await agent.post("/events/103/publish");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/events/103");
  });

  it("returns 401 when cancel is requested without authentication", async () => {
    const res = await request(app)
      .post("/events/101/cancel")
      .set("HX-Request", "true");

    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue.");
  });

  it("cancels a published event for an admin and returns the HTMX detail fragment", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);

    const res = await agent
      .post("/events/101/cancel")
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).toContain("event-detail-shell");
    expect(res.text).toContain("Cancelled");
    expect(res.text).not.toContain("Cancel Event");

    const eventResult = await eventRepository.findById(101);
    expect(eventResult.ok).toBe(true);
    if (eventResult.ok && eventResult.value) {
      expect(eventResult.value.status).toBe("cancelled");
    }
  });

  it("returns 403 when a non-owner tries to cancel a published event", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .post("/events/101/cancel")
      .set("HX-Request", "true");

    expect(res.status).toBe(403);
    expect(res.text).toContain("Only the organizer or an admin can cancel this event.");
  });

  it("returns 409 when trying to cancel a draft event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);

    const res = await agent
      .post("/events/103/cancel")
      .set("HX-Request", "true");

    expect(res.status).toBe(409);
    expect(res.text).toContain("Only published events can be cancelled.");
  });

  it("redirects after a successful non-HTMX cancel request", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);

    const res = await agent.post("/events/101/cancel");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/events/101");
  });
});