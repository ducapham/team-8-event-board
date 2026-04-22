import request from "supertest";
import type { Express } from "express";
import { createExposedApp } from "../ExposedComposition";

function getExpressApp() {
  const { app } = createExposedApp();
  return (app as any).getExpressApp();
}

describe("GET /events/archive", () => {
  let app: Express;

  beforeEach(() => {
    app = getExpressApp();
  });

  it("returns 401 when not authenticated", async () => {
    await request(app)
      .get("/events/archive")
      .set("HX-Request", "true")
      .expect(401);
  });

  it("returns past events", async () => {
    const agent = request.agent(app);

    await agent.post("/login").type("form").send({
      email: "user@app.test",
      password: "password123",
    });

    const res = await agent
      .get("/events/archive")
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Spring Music Festival");
  });

  it("filters by category", async () => {
    const agent = request.agent(app);

    await agent.post("/login").type("form").send({
      email: "user@app.test",
      password: "password123",
    });

    const res = await agent
      .get("/events/archive")
      .query({ category: "Music" })
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
  });
});