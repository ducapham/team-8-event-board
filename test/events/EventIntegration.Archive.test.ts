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

describe("GET /events/archive", () => {
  let app: Express;

  beforeEach(() => {
    app = getExpressApp();
  });

  it("blocks unauthenticated users", async () => {
    await request(app)
      .get("/events/archive")
      .set("HX-Request", "true")
      .expect(401);
  });

  it("returns only past events", async () => {
    const agent = await loginAs(app, "user@app.test", "password123");

    const res = await agent
      .get("/events/archive")
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Spring Music Festival");
    expect(res.text).not.toContain("Community Picnic");
  });

  it("filters by category", async () => {
    const agent = await loginAs(app, "user@app.test", "password123");

    const res = await agent
      .get("/events/archive")
      .query({ category: "Music" })
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
  });

  it("returns empty when no matches", async () => {
    const agent = await loginAs(app, "user@app.test", "password123");

    const res = await agent
      .get("/events/archive")
      .query({ category: "xyz" })
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("Spring Music Festival");
  });
});