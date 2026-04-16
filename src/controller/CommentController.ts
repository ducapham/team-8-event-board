// Feature 13 — Event Comments
// Controller: parses request, calls service, maps Result to HTTP response.
// No business logic lives here.

import type { Request, Response } from "express";
import type { ICommentService } from "../service/CommentService.js";
import type { IEventRepository } from "../repository/EventRepository.js";
import type { ILoggingService } from "../service/LoggingService.js";
import type { CommentError } from "../lib/errors.js";

export interface ICommentController {
  listComments(res: Response, eventId: number): Promise<void>;
  postComment(req: Request, res: Response, eventId: number, userId: string): Promise<void>;
  deleteComment(
    req: Request,
    res: Response,
    commentId: string,
    eventId: number,
    requestingUserId: string,
    requestingUserRole: string,
  ): Promise<void>;
}

class CommentController implements ICommentController {
  constructor(
    private readonly commentService: ICommentService,
    private readonly eventRepo: IEventRepository,
    private readonly logger: ILoggingService,
  ) {}

  async listComments(res: Response, eventId: number): Promise<void> {
    const result = await this.commentService.listComments(eventId);
    if (!result.ok) {
      const err = result.value as CommentError;
      res.status(404).render("partials/error", { message: err.message, layout: false });
      return;
    }
    res.render("comments/comment-list", { comments: result.value, eventId, layout: false });
  }

  async postComment(req: Request, res: Response, eventId: number, userId: string): Promise<void> {
    const content = typeof req.body.content === "string" ? req.body.content : "";
    this.logger.info(`POST /events/${eventId}/comments by user ${userId}`);

    const result = await this.commentService.postComment(eventId, userId, content);
    if (!result.ok) {
      const err = result.value as CommentError;
      res.status(400).render("partials/error", { message: err.message, layout: false });
      return;
    }

    const listResult = await this.commentService.listComments(eventId);
    if (!listResult.ok) {
      res.status(500).render("partials/error", { message: "Could not reload comments.", layout: false });
      return;
    }
    res.render("comments/comment-list", { comments: listResult.value, eventId, layout: false });
  }

  async deleteComment(
    req: Request,
    res: Response,
    commentId: string,
    eventId: number,
    requestingUserId: string,
    requestingUserRole: string,
  ): Promise<void> {
    this.logger.info(`DELETE comment ${commentId} by user ${requestingUserId}`);

    const eventResult = await this.eventRepo.findById(eventId);
    const organizerId = eventResult.ok && eventResult.value ? eventResult.value.organizerId : "";

    const result = await this.commentService.deleteComment(
      commentId, requestingUserId, requestingUserRole, organizerId,
    );

    if (!result.ok) {
      const err = result.value as CommentError;
      const status = err.name === "CommentNotFound" ? 404 : 403;
      res.status(status).render("partials/error", { message: err.message, layout: false });
      return;
    }

    const listResult = await this.commentService.listComments(eventId);
    if (!listResult.ok) {
      res.status(500).render("partials/error", { message: "Could not reload comments.", layout: false });
      return;
    }
    res.render("comments/comment-list", { comments: listResult.value, eventId, layout: false });
  }
}

export function CreateCommentController(
  commentService: ICommentService,
  eventRepo: IEventRepository,
  logger: ILoggingService,
): ICommentController {
  return new CommentController(commentService, eventRepo, logger);
}
