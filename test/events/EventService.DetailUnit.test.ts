import { CreateEventService } from "../../src/service/EventService";
import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
import { CreateInMemoryUserRepository } from "../../src/auth/InMemoryUserRepository";

function createServiceWithFreshData() {
  const users = CreateInMemoryUserRepository();
  const eventRepo = CreateInMemoryEventRepository(users);
  const service = CreateEventService(eventRepo);
  return { service, eventRepo };
}

describe("Event Detail behavior", () => {
  it("returns the event when the id exists", async () => {
    const { service } = createServiceWithFreshData();

    const created = await service.createEvent(
      {
        title: "Detail Test Event",
        description: "Test description",
        location: "Campus Center",
        category: "Social",
        capacity: 5,
        startDatetime: "2026-04-20T10:00",
        endDatetime: "2026-04-20T12:00",
      },
      "user-admin",
    );

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await service.getEventById(String(created.value.id), "user-admin");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.id).toBe(created.value.id);
    expect(result.value.title).toBe("Detail Test Event");
  });

  it("returns EventNotFoundError when the id does not exist", async () => {
    const { service } = createServiceWithFreshData();

    const result = await service.getEventById("missing-id", "user-admin");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value.name).toBe("EventNotFoundError");
  });

  it("returns ForbiddenError when a non-organizer tries to view a draft event", async () => {
    const { service } = createServiceWithFreshData();

    const created = await service.createEvent(
      {
        title: "Draft Event",
        description: "Test description",
        location: "Campus Center",
        category: "Social",
        capacity: 5,
        startDatetime: "2026-04-20T10:00",
        endDatetime: "2026-04-20T12:00",
      },
      "owner-1",
    );

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await service.getEventById(String(created.value.id), "other-user");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value.name).toBe("ForbiddenError");
  });

  it("allows the organizer to view their own draft event", async () => {
    const { service } = createServiceWithFreshData();

    const created = await service.createEvent(
      {
        title: "My Draft Event",
        description: "Test description",
        location: "Campus Center",
        category: "Social",
        capacity: 5,
        startDatetime: "2026-04-20T10:00",
        endDatetime: "2026-04-20T12:00",
      },
      "owner-1",
    );

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await service.getEventById(String(created.value.id), "owner-1");

    expect(result.ok).toBe(true);
  });
});