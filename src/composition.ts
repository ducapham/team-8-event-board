import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import { CreateEventController } from "./controller/EventController";
import { CreateEventService } from "./service/EventService";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
import { createRuntimePrismaEventResources } from "./repository/createRuntimePrismaEventResources";
// Feature 12 — Attendee List
import { CreateAttendeeListService } from "./service/AttendeeListService";
import { CreateAttendeeListController } from "./controller/AttendeeListController";
// Feature 13 — Event Comments
import { CreatePrismaCommentRepository } from "./repository/PrismaCommentRepository";
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

  // Feature 5 lifecycle publish/cancel flows now use Prisma-backed event data.
  const { prisma, eventRepository: prismaEventRepository } = createRuntimePrismaEventResources(authUsers);
  const eventService = CreateEventService(prismaEventRepository);
  const eventController = CreateEventController(eventService, resolvedLogger);

  // Other repository consumers stay on the existing in-memory path for now.
  // const eventRepository = CreateInMemoryEventRepository(authUsers);
  // const prismaclient = new PrismaClient({
  //           adapter: new PrismaBetterSqlite3({
  //             url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  //           }),
  //         })
  // const eventRepository = CreatePrismaEventRepository(prismaclient, authUsers)

  // Feature 12 — Attendee List
  const attendeeListService = CreateAttendeeListService(prismaEventRepository);
  const attendeeListController = CreateAttendeeListController(attendeeListService, resolvedLogger);

  // Feature 13 — Event Comments wiring (now Prisma-backed for Sprint 3)
  const commentRepository = CreatePrismaCommentRepository(prisma);
  const commentService = CreateCommentService(prismaEventRepository, commentRepository, authUsers);
  const commentController = CreateCommentController(commentService, prismaEventRepository, resolvedLogger);

  return CreateApp(
    authController,
    eventController,
    resolvedLogger,
    attendeeListController,
    prismaEventRepository,
    commentController,
  );
}
