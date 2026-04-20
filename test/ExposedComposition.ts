import { CreateAdminUserService } from "../src/auth/AdminUserService";
import { CreateAuthController } from "../src/auth/AuthController";
import { CreateAuthService } from "../src/auth/AuthService";
import { CreateInMemoryUserRepository } from "../src/auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "../src/auth/PasswordHasher";
import { CreateApp } from "../src/app";
import { CreateEventController } from "../src/controller/EventController";
import { CreateEventService } from "../src/service/EventService";
import { CreateInMemoryEventRepository } from "../src/repository/InMemoryEventRepository";
import type { IApp } from "../src/contracts";
import { CreateLoggingService } from "../src/service/LoggingService";
import type { ILoggingService } from "../src/service/LoggingService";
// Feature 12 — Attendee List
import { CreateAttendeeListService } from "../src/service/AttendeeListService";
import { CreateAttendeeListController } from "../src/controller/AttendeeListController";
// Feature 13 — Event Comments
import { CreateInMemoryCommentRepository } from "../src/repository/InMemoryCommentRepository";
import { CreateCommentService } from "../src/service/CommentService";
import { CreateCommentController } from "../src/controller/CommentController";
import { IEventRepository } from "../src/repository/EventRepository";
import { ICommentRepository } from "../src/repository/CommentRepository";

export function createExposedApp(logger?: ILoggingService): { app: IApp, eventRepository: IEventRepository, commentRepository:ICommentRepository } {
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

  return {app: CreateApp(
    authController,
    eventController,
    resolvedLogger,
    attendeeListController,
    eventRepository,
    commentController,
  ), eventRepository, commentRepository};
}