import request from "supertest";
import type { Express } from "express";
import { createFilterPrismaExposedApp } from "../ExposedComposition";

const EVENTS_PATH = "/events";
const FIXED_NOW = new Date("2026-04-20T09:00:00");
const RealDate = Date;
type FrozenDateArgs =
  | []
  | [string | number | Date]
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | [number, number, number, number, number]
  | [number, number, number, number, number, number]
  | [number, number, number, number, number, number, number];
const READER_EMAIL = "user@app.test";
const READER_PASSWORD = "password123";
const STAFF_EMAIL = "staff@app.test";
const STAFF_PASSWORD = "password123";

function freezeCurrentDate(value: Date): void {
  const FrozenDate = class extends RealDate {
    constructor(...dateArgs: FrozenDateArgs) {
      switch (dateArgs.length) {
        case 0:
          super(value);
          return;
        case 1:
          super(dateArgs[0]);
          return;
        case 2:
          super(dateArgs[0], dateArgs[1]);
          return;
        case 3:
          super(dateArgs[0], dateArgs[1], dateArgs[2]);
          return;
        case 4:
          super(dateArgs[0], dateArgs[1], dateArgs[2], dateArgs[3]);
          return;
        case 5:
          super(dateArgs[0], dateArgs[1], dateArgs[2], dateArgs[3], dateArgs[4]);
          return;
        case 6:
          super(
            dateArgs[0],
            dateArgs[1],
            dateArgs[2],
            dateArgs[3],
            dateArgs[4],
            dateArgs[5],
          );
          return;
        default:
          super(
            dateArgs[0],
            dateArgs[1],
            dateArgs[2],
            dateArgs[3],
            dateArgs[4],
            dateArgs[5],
            dateArgs[6],
          );
      }
    }

    static now(): number {
      return value.getTime();
    }
  } as DateConstructor;

  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;

  global.Date = FrozenDate;
}

function getExpressApp(): Express {
  const { app } = createFilterPrismaExposedApp(undefined, FIXED_NOW);
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

describe(`GET ${EVENTS_PATH} — filter integration`, () => {
  let app: Express;

  beforeEach(() => {
    freezeCurrentDate(FIXED_NOW);
    app = getExpressApp();
  });

  afterEach(() => {
    global.Date = RealDate;
  });

  it("redirects unauthenticated normal requests to login", async () => {
    const res = await request(app).get(EVENTS_PATH);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("returns 401 for unauthenticated HTMX filter requests", async () => {
    const res = await request(app)
      .get(EVENTS_PATH)
      .set("HX-Request", "true");

    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue.");
  });

  it("renders the full board page for a valid non-HTMX filter request", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent.get(EVENTS_PATH).query({ timeframe: "this-week" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Local Event Board");
    expect(res.text).toContain("Neighborhood Social Mixer");
    expect(res.text).toContain("Park Cleanup Drive");
    expect(res.text).toContain("Weekend Art Walk");
  });

  it("returns only the list fragment for a valid HTMX filter request", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .get(EVENTS_PATH)
      .query({ timeframe: "this-week" })
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).toContain("<section class=\"space-y-6\">");
    expect(res.text).toContain("Neighborhood Social Mixer");
    expect(res.text).not.toContain("Local Event Board");
  });

  it("returns 400 and a full-page error for an invalid category", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent.get(EVENTS_PATH).query({ category: "sports" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Local Event Board");
    expect(res.text).toContain("Category filter is invalid.");
  });

  it("returns 400 and a list-fragment error for an invalid timeframe HTMX request", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .get(EVENTS_PATH)
      .query({ timeframe: "next-month" })
      .set("HX-Request", "true");

    expect(res.status).toBe(400);
    expect(res.text).toContain("Timeframe filter is invalid.");
    expect(res.text).toContain("No events match your search.");
    expect(res.text).not.toContain("Local Event Board");
  });

  it("supports combining query and timeframe filters", async () => {
    const agent = await loginAs(app, READER_EMAIL, READER_PASSWORD);

    const res = await agent
      .get(EVENTS_PATH)
      .query({ query: "riverside", timeframe: "this-week" })
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Neighborhood Social Mixer");
    expect(res.text).toContain("Park Cleanup Drive");
    expect(res.text).not.toContain("Weekend Art Walk");
  });

  it("includes the organizer's own draft in filtered results for staff", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);

    const res = await agent
      .get(EVENTS_PATH)
      .query({ query: "Accessibility" })
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Accessibility Workshop");
  });
});