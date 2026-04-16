// Feature 13 — Event Comments
// Service layer: all business logic for posting, listing, and deleting comments.
// No HTTP knowledge here — receives user identity as parameters.

import { randomUUID } from "node:crypto";
import { Ok, Err, type Result } from "../lib/result.js";
import type { IEventRepository } from "../repository/EventRepository.js";
import type { IUserRepository } from "../auth/UserRepository.js";
import type { ICommentRepository } from "../repository/CommentRepository.js";
import type { ICommentWithAuthor } from "../Comment.js";
import {
  EmptyContent,
  CommentEventNotFound,
  CommentNotFound,
  UnauthorizedDeletion,
  type CommentError,
} from "../lib/errors.js";

export interface ICommentService {
  listComments(eventId: number): Promise<Result<ICommentWithAuthor[], CommentError>>;
  postComment(
    eventId: number,
    userId: string,
    content: string,
  ): Promise<Result<ICommentWithAuthor, CommentError>>;
  deleteComment(
    commentId: string,
    requestingUserId: string,
    requestingUserRole: string,
    eventOrganizerId: string,
  ): Promise<Result<boolean, CommentError>>;
}

class CommentService implements ICommentService {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly commentRepo: ICommentRepository,
    private readonly userRepo: IUserRepository,
  ) {}

  private async enrichComment(comment: {
    id: string; eventId: number; userId: string; content: string; createdAt: Date;
  }): Promise<ICommentWithAuthor> {
    const userResult = await this.userRepo.findById(comment.userId);
    const authorName = userResult.ok && userResult.value ? userResult.value.displayName : "Unknown User";
    return { ...comment, authorName };
  }

  async listComments(eventId: number): Promise<Result<ICommentWithAuthor[], CommentError>> {
    const eventResult = await this.eventRepo.findById(eventId);
    if (!eventResult.ok || !eventResult.value) return Err(CommentEventNotFound(eventId));

    const comments = await this.commentRepo.findByEventId(eventId);
    const enriched = await Promise.all(comments.map((c) => this.enrichComment(c)));
    return Ok(enriched);
  }

  async postComment(
    eventId: number,
    userId: string,
    content: string,
  ): Promise<Result<ICommentWithAuthor, CommentError>> {
    if (!content.trim()) return Err(EmptyContent());

    const eventResult = await this.eventRepo.findById(eventId);
    if (!eventResult.ok || !eventResult.value) return Err(CommentEventNotFound(eventId));

    const created = await this.commentRepo.create({
      id: randomUUID(),
      eventId,
      userId,
      content: content.trim(),
      createdAt: new Date(),
    });

    return Ok(await this.enrichComment(created));
  }

  async deleteComment(
    commentId: string,
    requestingUserId: string,
    requestingUserRole: string,
    eventOrganizerId: string,
  ): Promise<Result<boolean, CommentError>> {
    const comment = await this.commentRepo.findById(commentId);
    if (!comment) return Err(CommentNotFound(commentId));

    const isAuthor = comment.userId === requestingUserId;
    const isOrganizer = requestingUserId === eventOrganizerId;
    const isAdmin = requestingUserRole === "admin";

    if (!isAuthor && !isOrganizer && !isAdmin) return Err(UnauthorizedDeletion());

    await this.commentRepo.delete(commentId);
    return Ok(true);
  }
}

export function CreateCommentService(
  eventRepo: IEventRepository,
  commentRepo: ICommentRepository,
  userRepo: IUserRepository,
): ICommentService {
  return new CommentService(eventRepo, commentRepo, userRepo);
}
