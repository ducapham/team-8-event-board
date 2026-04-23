import request from "supertest";
import type { Express } from "express";
import { createExposedApp } from "../ExposedComposition";

function getExpressApp() {
  const { app } = createExposedApp();
  return (app as any).getExpressApp();
}

async function loginAs(app: Express, email: string, password: string) {
  const agent = request.agent(app);

  await agent.post("/login").type("form").send({
    email,
    password,
  });

  return agent;
}

describe("GET /my-rsvps", () => {
  let app: Express;

  beforeEach(() => {
    app = getExpressApp();
  });

  it("redirects unauthenticated users to login", async () => {
    const res = await request(app).get("/my-rsvps");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/login");
  });

  it("shows RSVP dashboard for regular users", async () => {
    const agent = await loginAs(app, "user@app.test", "password123");

    const res = await agent.get("/my-rsvps");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Upcoming");
    expect(res.text).toContain("Past");
  });

  it("allows admin users to access RSVP dashboard", async () => {
    const agent = await loginAs(app, "admin@app.test", "password123");

    const res = await agent.get("/my-rsvps");

    expect(res.status).toBe(200);
  });

  it("blocks users who are organizers", async () => {
    const agent = await loginAs(app, "staff@app.test", "password123");

    // create event -> makes this user an organizer
    const createRes = await agent.post("/events").type("form").send({
      title: "Test Event",
      description: "desc",
      location: "here",
      category: "social",
      capacity: "10",
      startDatetime: "2030-01-01T10:00",
      endDatetime: "2030-01-01T12:00",
    });

    expect(createRes.status).toBe(302);

    const res = await agent.get("/my-rsvps");

    expect(res.status).toBe(403);
  });
});