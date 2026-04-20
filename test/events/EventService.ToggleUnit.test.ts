import { CreateEventService } from "../../src/service/EventService";
import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
import { CreateInMemoryUserRepository } from "../../src/auth/InMemoryUserRepository";
import { RSVPNotAllowedError, EventNotFoundError, UserNotFoundError } from "../../src/lib/errors";

function createServiceWithFreshData() {
  const users = CreateInMemoryUserRepository();
  const eventRepo = CreateInMemoryEventRepository(users);
  const service = CreateEventService(eventRepo);
  return { service, eventRepo };
}

describe("Event RSVP toggle behavior", () => {
  it("registers a member when the event has room", async () => {
    const { service, eventRepo } = createServiceWithFreshData();

    const toggleResult = await service.Toggle(101, "user-reader");
    expect(toggleResult.ok).toBe(true);

    const storedEvent = await eventRepo.findById(101);
    expect(storedEvent.ok).toBe(true);
    if (storedEvent.ok && storedEvent.value) {
      expect(storedEvent.value.attendees.some(a => a.id === "user-reader")).toBe(true);
    }
  });


  it("places a member on the waitlist when the event is full", async () => {
    const { service, eventRepo } = createServiceWithFreshData();

    const firstResult = await service.Toggle(102, "user-reader");
    expect(firstResult.ok).toBe(true);

    const secondResult = await service.Toggle(102, "user-admin");
    expect(secondResult.ok).toBe(true);

    const storedEvent = await eventRepo.findById(102);
    expect(storedEvent.ok).toBe(true);
    if (storedEvent.ok && storedEvent.value) {
      expect(storedEvent.value.attendees).toHaveLength(1);
      expect(storedEvent.value.attendees[0].id).toBe("user-reader");
      expect(storedEvent.value.waitlist).toHaveLength(1);
      expect(storedEvent.value.waitlist[0].id).toBe("user-admin");
    }
  });

  it("rejects RSVP attempts for past events", async () => {
    const { service } = createServiceWithFreshData();
    const result = await service.Toggle(105, "user-reader");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value).toBeInstanceOf(RSVPNotAllowedError);
      expect(result.value.name).toBe("RSVPNotAllowedError");
      expect(result.value.message).toBe("Cannot RSVP to a past event.");
    }
  });

  it("rejects RSVP attempts for non-existent events", async () => {
    const { service } = createServiceWithFreshData();
    const result = await service.Toggle(999, "user-reader");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value).toBeInstanceOf(EventNotFoundError);
      expect(result.value.name).toBe("EventNotFoundError");
      expect(result.value.message).toBe("Event with ID 999 not found");
    }
  });

  it("rejects RSVP attempts for non-existent users", async () => {
    const { service } = createServiceWithFreshData();
    const result = await service.Toggle(101, "user-unknown");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value).toBeInstanceOf(UserNotFoundError);
      expect(result.value.name).toBe("UserNotFoundError");
      expect(result.value.message).toBe("User with ID user-unknown not found");
    }
  });
});
