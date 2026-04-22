import { CreateInMemoryUserRepository } from "../../src/auth/InMemoryUserRepository";
import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
import { CreateEventService } from "../../src/service/EventService";

const fixedNow = new Date("2026-04-20T09:00:00");

function createServiceWithFrozenData() {
  jest.useFakeTimers();
  jest.setSystemTime(fixedNow);

  const users = CreateInMemoryUserRepository();
  const eventRepo = CreateInMemoryEventRepository(users);
  const service = CreateEventService(eventRepo);

  return { service, eventRepo };
}

describe("Event filter behavior", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns InvalidCategoryFilterError for an unknown category", async () => {
    const { service } = createServiceWithFrozenData();

    const result = await service.listPublishedEvents({ category: "sports" }, undefined, fixedNow);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.value.name).toBe("InvalidCategoryFilterError");
    expect(result.value.message).toBe("Category filter is invalid.");
  });

  it("returns InvalidTimeframeFilterError for an unknown timeframe", async () => {
    const { service } = createServiceWithFrozenData();

    const result = await service.listPublishedEvents({ timeframe: "next-month" }, undefined, fixedNow);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.value.name).toBe("InvalidTimeframeFilterError");
    expect(result.value.message).toBe("Timeframe filter is invalid.");
  });

  it("filters upcoming published events by category", async () => {
    const { service } = createServiceWithFrozenData();

    const result = await service.listPublishedEvents({ category: "arts" }, undefined, fixedNow);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events.map((event) => event.id)).toEqual([102]);
    expect(result.value.filters.category).toBe("arts");
  });

  it("filters to events in the current week", async () => {
    const { service } = createServiceWithFrozenData();

    const result = await service.listPublishedEvents({ timeframe: "this-week" }, undefined, fixedNow);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events.map((event) => event.id)).toEqual([101, 104, 102]);
    expect(result.value.filters.timeframe).toBe("this-week");
  });

  it("filters to events in the current weekend only", async () => {
    const { service } = createServiceWithFrozenData();

    const result = await service.listPublishedEvents({ timeframe: "this-weekend" }, undefined, fixedNow);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events.map((event) => event.id)).toEqual([102]);
  });

  it("matches the query against title, description, location, and category", async () => {
    const { service } = createServiceWithFrozenData();

    const result = await service.listPublishedEvents({ query: "riverside" }, undefined, fixedNow);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events.map((event) => event.id)).toEqual([101, 104, 1]);
  });

  it("includes the organizer's own draft event in the filtered list", async () => {
    const { service } = createServiceWithFrozenData();

    const result = await service.listPublishedEvents({}, "user-staff", fixedNow);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events.some((event) => event.id === 103)).toBe(true);
  });

  it("does not include another organizer's draft event for general viewers", async () => {
    const { service } = createServiceWithFrozenData();

    const result = await service.listPublishedEvents({}, undefined, fixedNow);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events.some((event) => event.id === 103)).toBe(false);
  });
});
