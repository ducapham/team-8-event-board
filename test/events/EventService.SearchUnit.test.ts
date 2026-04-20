import { CreateEventService } from "../../src/service/EventService";
import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
import { CreateInMemoryUserRepository } from "../../src/auth/InMemoryUserRepository";
import type { IEventService } from "../../src/service/EventService";



function createServiceWithFreshData() {
  const users = CreateInMemoryUserRepository();
  const eventRepo = CreateInMemoryEventRepository(users);
  const service = CreateEventService(eventRepo);
  return { service, eventRepo };
}


async function search(
  service: IEventService,
  query: string,
  viewerId?: string,
) {
  const promise = service.Search(query, viewerId);
  jest.runAllTimers();
  return promise;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Event Search behavior", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Empty query ──────────────────────────────────────────────────────────

  it("returns all published upcoming events when the query is empty", async () => {
    const { service } = createServiceWithFreshData();

    const result = await search(service, "");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Every returned event must be published and in the future.
    result.value.forEach((e) => {
      expect(e.status).toBe("published");
      expect(e.startDatetime.getTime()).toBeGreaterThanOrEqual(Date.now());
    });
  });

  it("does not include past events when the query is empty", async () => {
    const { service } = createServiceWithFreshData();

    const result = await search(service, "");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // id 105 – Spring Music Festival (2024) must be excluded.
    expect(result.value.some((e) => e.id === 105)).toBe(false);
  });

  // ── Title match ──────────────────────────────────────────────────────────

  it("returns events whose title contains the query (case-insensitive)", async () => {
    const { service } = createServiceWithFreshData();

    const result = await search(service, "picnic"); // lowercase vs "Community Picnic"

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.some((e) => e.id === 1)).toBe(true);
  });

  // ── Location match ───────────────────────────────────────────────────────

  it("returns events whose location contains the query", async () => {
    const { service } = createServiceWithFreshData();

    const result = await search(service, "Riverside Park");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // id 1 – Community Picnic is at Riverside Park.
    expect(result.value.some((e) => e.id === 1)).toBe(true);
  });

  // ── Description match ────────────────────────────────────────────────────

  it("returns events whose description contains the query", async () => {
    const { service } = createServiceWithFreshData();

    // "investors" only appears in Startup Pitch Night's description.
    const result = await search(service, "investors");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.some((e) => e.id === 2)).toBe(true);
  });

  // ── Category match ───────────────────────────────────────────────────────

  it("returns only events whose category matches the query", async () => {
    const { service } = createServiceWithFreshData();

    const result = await search(service, "volunteer");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Every result must be in the Volunteer category.
    expect(result.value.length).toBeGreaterThan(0);
    result.value.forEach((e) => {
      expect(e.category.toLowerCase()).toBe("volunteer");
    });
  });

  // ── No match ─────────────────────────────────────────────────────────────

  it("returns an empty array when no event matches the query", async () => {
    const { service } = createServiceWithFreshData();

    const result = await search(service, "xyznonexistentterm");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  // ── Past event exclusion ─────────────────────────────────────────────────

  it("excludes past events even when the query matches their title", async () => {
    const { service } = createServiceWithFreshData();

    // "Spring Music Festival" matches id 105 (2024 — past).
    const result = await search(service, "Spring Music Festival");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.some((e) => e.id === 105)).toBe(false);
  });

  // ── Debounce behaviour ───────────────────────────────────────────────────

  it("debounces: only the latest query executes when Search is called rapidly", async () => {
    const { service } = createServiceWithFreshData();

    // Fire three rapid calls before any timer fires.
    const p1 = service.Search("Picnic");
    const p2 = service.Search("Startup");
    const p3 = service.Search("Park Cleanup");

    // All three calls return the SAME promise (the first one created).
    // The debounce timer resets to the latest query on each call.
    jest.runAllTimers();

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    // All three promises resolve to the same result object.
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);

    // The result reflects the LAST query ("Park Cleanup").
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    expect(r3.value.some((e) => e.id === 104)).toBe(true); // Park Cleanup Drive
    expect(r3.value.some((e) => e.id === 1)).toBe(false);  // Community Picnic — not matched
  });

  it("accepts a new query after the previous debounce has settled", async () => {
    const { service } = createServiceWithFreshData();

    // First search cycle.
    const first = await search(service, "Picnic");
    expect(first.ok).toBe(true);

    // Second search cycle — a fresh promise must be created by the service.
    const second = await search(service, "Startup");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.some((e) => e.id === 2)).toBe(true); // Startup Pitch Night
  });
});