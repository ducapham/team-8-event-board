import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import { CreateEventController } from "./controller/EventController";
import { CreateEventService } from "./service/EventService";
import { CreateInMemoryEventRepository } from "./repository/InMemoryEventRepository";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
// Feature 12 — Attendee List
import { CreateInMemoryRsvpRepository } from "./rsvp/InMemoryRsvpRepository";
import { CreateAttendeeListService } from "./rsvp/AttendeeListService";
import { CreateAttendeeListController } from "./rsvp/AttendeeListController";
// Feature 13 — Event Comments
import { CreateInMemoryCommentRepository } from "./repository/InMemoryCommentRepository";
import { CreateCommentService } from "./service/CommentService";
import { CreateCommentController } from "./controller/CommentController";

export function createComposedApp(logger?: ILoggingService): IApp {
  const resolvedLogger = logger ?? CreateLoggingService();

  // Authentication & authorization wiring
  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(authService, adminUserService, resolvedLogger);

  // Event management wiring
  const eventRepository = CreateInMemoryEventRepository(authUsers);
  const eventService = CreateEventService(eventRepository);
  const eventController = CreateEventController(eventService, resolvedLogger);

  // Feature 12 — Attendee List
  const attendeeListService = CreateAttendeeListService(eventRepository);
  const attendeeListController = CreateAttendeeListController(attendeeListService, resolvedLogger);

  // Feature 13 — Event Comments wiring
  const commentRepository = CreateInMemoryCommentRepository();
  const commentService = CreateCommentService(eventRepository, commentRepository, authUsers);
  const commentController = CreateCommentController(commentService, eventRepository, resolvedLogger);

  return CreateApp(
    authController,
    eventController,
    resolvedLogger,
    attendeeListController,
    eventRepository,
    commentController,
  );
}
