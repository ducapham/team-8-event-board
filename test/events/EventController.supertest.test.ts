import request from "supertest";
import { createComposedApp } from "../../src/composition";

async function loginAs(agent: request.SuperTest<request.Test>, email: string, password: string) {
  const response = await agent
    .post("/login")
    .type("form")
    .send({ email, password });

  expect(response.status).toBe(302);
  return agent;
}

describe("Event routes with HTMX", () => {
  let app: Express.Application;

  beforeEach(() => {
    app = createComposedApp().getExpressApp();
  });

  it("returns upcoming published event search results for a matching query", async () => {
    const agent = request.agent(app);
    await loginAs(agent, "user@app.test", "password123");

    const response = await agent
      .get("/events/search")
      .query({ query: "Picnic" })
      .set("HX-Request", "true");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Community Picnic");
    expect(response.text).toContain("Category:");
  });

  it("returns the no-results message when the query does not match any upcoming published events", async () => {
    const agent = request.agent(app);
    await loginAs(agent, "user@app.test", "password123");

    const response = await agent
      .get("/events/search")
      .query({ query: "unicorn" })
      .set("HX-Request", "true");

    expect(response.status).toBe(200);
    expect(response.text).toContain("No events match your search.");
  });

  it("toggles an RSVP through the HTMX toggle endpoint and renders the updated partial", async () => {
    const agent = request.agent(app);
    await loginAs(agent, "user@app.test", "password123");

    const response = await agent
      .post("/events/101/toggle")
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(response.status).toBe(200);
    expect(response.text).toContain("Cancel RSVP");
    expect(response.text).toContain("1 / 40");
  });

  it("rejects an organizer from RSVPing to their own event with a 403 response", async () => {
    const agent = request.agent(app);
    await loginAs(agent, "staff@app.test", "password123");

    const response = await agent
      .post("/events/101/toggle")
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(response.status).toBe(403);
    expect(response.text).toContain("Organizers cannot RSVP to their own event.");
  });
});
