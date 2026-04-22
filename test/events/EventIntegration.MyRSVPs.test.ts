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

  it("blocks unauthenticated users", async () => {
    const res = await request(app).get("/my-rsvps");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/login");
  });

  it("returns RSVP dashboard with grouped sections", async () => {
    const agent = await loginAs(app, "user@app.test", "password123");

    const res = await agent.get("/my-rsvps");

    expect(res.status).toBe(200);

    expect(res.text).toContain("Going");
    expect(res.text).toContain("Waitlisted");
    expect(res.text).toContain("Cancelled");
  });

  it("allows access for different authenticated users", async () => {
    const agent = await loginAs(app, "staff@app.test", "password123");

    const res = await agent.get("/my-rsvps");

    expect(res.status).toBe(200);
  });

  it("blocks organizers from accessing RSVP dashboard", async () => {
    const agent = await loginAs(app, "organizer@app.test", "password123");

    const res = await agent.get("/my-rsvps");

    expect([302, 403]).toContain(res.status);
  });
});