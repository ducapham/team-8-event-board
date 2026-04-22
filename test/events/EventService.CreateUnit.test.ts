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

describe("Event Creation behavior", () => {
  it("creates an event successfully when the input is valid", async () => {
    const { service } = createServiceWithFreshData();

    const result = await service.createEvent(
      {
        title: "Test Event",
        description: "Test description",
        location: "Campus Center",
        category: "Social",
        capacity: 10,
        startDatetime: "2026-04-20T10:00",
        endDatetime: "2026-04-20T12:00",
      },
      "user-admin",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.title).toBe("Test Event");
    expect(result.value.description).toBe("Test description");
    expect(result.value.organizerId).toBe("user-admin");
    expect(result.value.status).toBe("draft");
  });

  it("returns InvalidInputError when the title is empty", async () => {
    const { service } = createServiceWithFreshData();

    const result = await service.createEvent(
      {
        title: "",
        description: "Test description",
        location: "Campus Center",
        category: "Social",
        capacity: 10,
        startDatetime: "2026-04-20T10:00",
        endDatetime: "2026-04-20T12:00",
      },
      "user-admin",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value.name).toBe("InvalidInputError");
  });

  it("returns InvalidInputError when endDatetime is before startDatetime", async () => {
    const { service } = createServiceWithFreshData();

    const result = await service.createEvent(
      {
        title: "Bad Event",
        description: "Test description",
        location: "Campus Center",
        category: "Social",
        capacity: 10,
        startDatetime: "2026-04-20T12:00",
        endDatetime: "2026-04-20T10:00",
      },
      "user-admin",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value.name).toBe("InvalidInputError");
    expect(result.value.message).toMatch(/end time must be after start time/i);
  });

  it("returns InvalidInputError when capacity is not positive", async () => {
    const { service } = createServiceWithFreshData();

    const result = await service.createEvent(
      {
        title: "Bad Capacity Event",
        description: "Test description",
        location: "Campus Center",
        category: "Social",
        capacity: 0,
        startDatetime: "2026-04-20T10:00",
        endDatetime: "2026-04-20T12:00",
      },
      "user-admin",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value.name).toBe("InvalidInputError");
  });

  it("returns InvalidInputError when organizerId is empty", async () => {
    const { service } = createServiceWithFreshData();

    const result = await service.createEvent(
      {
        title: "No Organizer Event",
        description: "Test description",
        location: "Campus Center",
        category: "Social",
        capacity: 10,
        startDatetime: "2026-04-20T10:00",
        endDatetime: "2026-04-20T12:00",
      },
      "",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value.name).toBe("InvalidInputError");
  });
});