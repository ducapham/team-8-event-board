import { CreateInMemoryUserRepository } from "../../src/auth/InMemoryUserRepository";
import { createTestPrismaEventResources } from "../helpers/createTestPrismaEventResources";
import type { IEventRepository } from "../../src/repository/EventRepository";

const fixedNow = new Date("2026-04-20T09:00:00");

describe("PrismaEventRepository upcoming published queries", () => {
  let eventRepository: IEventRepository;
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(() => {
    const authUsers = CreateInMemoryUserRepository();
    const resources = createTestPrismaEventResources(authUsers, fixedNow);
    eventRepository = resources.eventRepository;
    cleanup = resources.cleanup;
  });

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("lists published upcoming events in chronological order", async () => {
    const result = await eventRepository.listUpcomingPublishedEvents(fixedNow);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.map((event) => event.id)).toEqual([101, 104, 102, 1, 2]);
  });

  it("filters published upcoming events by category", async () => {
    const result = await eventRepository.listUpcomingPublishedEvents(fixedNow, "social");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.map((event) => event.id)).toEqual([101, 1]);
  });

  it("filters published upcoming events to the current week", async () => {
    const result = await eventRepository.listUpcomingPublishedEvents(
      fixedNow,
      undefined,
      "this-week",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.map((event) => event.id)).toEqual([101, 104, 102]);
  });

  it("filters published upcoming events to the current weekend", async () => {
    const result = await eventRepository.listUpcomingPublishedEvents(
      fixedNow,
      undefined,
      "this-weekend",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.map((event) => event.id)).toEqual([102]);
  });
});