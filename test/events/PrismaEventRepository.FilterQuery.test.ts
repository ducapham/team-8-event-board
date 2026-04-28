import { CreateInMemoryUserRepository } from "../../src/auth/InMemoryUserRepository";
import { createTestPrismaEventResources } from "../../src/repository/PrismaEventBootstrap";
import type { IEventRepository } from "../../src/repository/EventRepository";

const fixedNow = new Date("2026-04-20T09:00:00");

describe("PrismaEventRepository upcoming published queries", () => {
  let eventRepository: IEventRepository;
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(() => {
    const authUsers = CreateInMemoryUserRepository();
    const resources = createTestPrismaEventResources(authUsers);
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
});