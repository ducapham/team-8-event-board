import { CreateEventService, type EventActor } from "../../src/service/EventService";
import { CreateInMemoryUserRepository } from "../../src/auth/InMemoryUserRepository";
import { createTestPrismaEventResources } from "../helpers/createTestPrismaEventResources";
import type { IEventRepository } from "../../src/repository/EventRepository";

describe("EventService lifecycle transitions", () => {
  const staffActor: EventActor = { userId: "user-staff", role: "staff" };
  const adminActor: EventActor = { userId: "user-admin", role: "admin" };
  const userActor: EventActor = { userId: "user-reader", role: "user" };
  const authUsers = CreateInMemoryUserRepository();
  let eventRepository: IEventRepository;
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(() => {
    const resources = createTestPrismaEventResources(authUsers);
    eventRepository = resources.eventRepository;
    cleanup = resources.cleanup;
  });

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("allows the organizer to publish a draft event", async () => {
    const service = CreateEventService(eventRepository);

    const result = await service.publishEvent("103", staffActor);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.event.status).toBe("published");
      expect(result.value.permissions.canPublish).toBe(false);
      expect(result.value.permissions.canCancel).toBe(true);
    }
  });

  it("allows an admin to publish a draft event", async () => {
    const service = CreateEventService(eventRepository);

    const result = await service.publishEvent("103", adminActor);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.event.status).toBe("published");
      expect(result.value.permissions.canCancel).toBe(true);
    }
  });

  it("rejects publishing a draft event by a non-owner", async () => {
    const service = CreateEventService(eventRepository);

    const result = await service.publishEvent("103", userActor);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("UnauthorizedEventActionError");
      expect(result.value.message).toBe("Only the organizer or an admin can publish this event.");
    }
  });

  it("rejects publishing an already published event", async () => {
    const service = CreateEventService(eventRepository);

    const result = await service.publishEvent("101", staffActor);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("InvalidEventTransitionError");
      expect(result.value.message).toBe("Only draft events can be published.");
    }
  });

  it("allows the organizer to cancel a published event", async () => {
    const service = CreateEventService(eventRepository);

    const result = await service.cancelEvent("101", staffActor);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.event.status).toBe("cancelled");
      expect(result.value.permissions.canPublish).toBe(false);
      expect(result.value.permissions.canCancel).toBe(false);
    }
  });

  it("allows an admin to cancel a published event", async () => {
    const service = CreateEventService(eventRepository);

    const result = await service.cancelEvent("104", adminActor);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.event.status).toBe("cancelled");
      expect(result.value.permissions.canCancel).toBe(false);
    }
  });

  it("rejects cancelling a published event by a non-owner", async () => {
    const service = CreateEventService(eventRepository);

    const result = await service.cancelEvent("101", userActor);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("UnauthorizedEventActionError");
      expect(result.value.message).toBe("Only the organizer or an admin can cancel this event.");
    }
  });

  it("rejects cancelling a draft event", async () => {
    const service = CreateEventService(eventRepository);

    const result = await service.cancelEvent("103", staffActor);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("InvalidEventTransitionError");
      expect(result.value.message).toBe("Only published events can be cancelled.");
    }
  });

  it("rejects cancelling an already cancelled event", async () => {
    const service = CreateEventService(eventRepository);

    const firstResult = await service.cancelEvent("104", adminActor);
    expect(firstResult.ok).toBe(true);

    const secondResult = await service.cancelEvent("104", adminActor);

    expect(secondResult.ok).toBe(false);
    if (!secondResult.ok) {
      expect(secondResult.value.name).toBe("InvalidEventTransitionError");
      expect(secondResult.value.message).toBe("Only published events can be cancelled.");
    }
  });
});