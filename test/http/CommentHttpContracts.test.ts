// Feature 13 — Event Comments: HTTP contract tests
//
// These tests exercise the comment endpoints end-to-end through Express
// using supertest, against the in-memory composition. No database required.
//
// What we verify for each endpoint:
//   1. Happy path: valid input returns 200 with the expected HTML fragment.
//   2. Each domain error returns the correct status + error message.
//   3. At least one edge case specific to the feature.
//
// When we swap to Prisma in Sprint 3, these same tests should still pass
// as long as the HTTP contract and seed data match.

import request from "supertest";
import type { Express } from "express";
import { createComposedApp } from "../../src/composition";
import type { ILoggingService } from "../../src/service/LoggingService";

function makeSilentLogger(): ILoggingService {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as ILoggingService;
}

// Helper: log in as a demo user and return an authenticated supertest agent.
// The agent persists the session cookie across requests.
async function loginAs(
  app: Express,
  email: string,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const response = await agent
    .post("/login")
    .type("form")
    .send({ email, password: "password123" });

  // loginFromForm redirects to "/" on success.
  expect(response.status).toBe(302);
  return agent;
}

describe("Feature 13 — Event Comments HTTP contracts", () => {
  let app: Express;

  beforeEach(() => {
    // A fresh composition per test => fresh in-memory seed data.
    app = createComposedApp(makeSilentLogger()).getExpressApp();
  });

  // ────────────────────────────────────────────────────────────────
  // GET /events/:id/comments  — list the comments for an event
  // ────────────────────────────────────────────────────────────────
  describe("GET /events/:id/comments", () => {
    it("happy path: returns 200 and an HTML fragment with seed comments", async () => {
      const agent = await loginAs(app, "user@app.test");

      const response = await agent.get("/events/1/comments");

      expect(response.status).toBe(200);
      // The partial is rendered with layout:false, so no <html> wrapper.
      expect(response.text).not.toContain("<html>");
      // It should contain the seed comments for event 1.
      expect(response.text).toContain("Looking forward to this!");
      expect(response.text).toContain("Yes, snacks will be provided");
      // And the HTMX post form should be in the fragment.
      expect(response.text).toContain('hx-post="/events/1/comments"');
    });

    it("returns 404 for an event that doesn't exist (EventNotFound)", async () => {
      const agent = await loginAs(app, "user@app.test");

      const response = await agent.get("/events/9999/comments");

      expect(response.status).toBe(404);
      // EJS HTML-escapes apostrophes to &#39;, so check the phrase in pieces
      // rather than expecting a literal quote character.
      expect(response.text).toContain("9999");
      expect(response.text).toContain("was not found");
    });

    it("edge case: returns 200 and a 'no comments' message for an event with zero comments", async () => {
      const agent = await loginAs(app, "user@app.test");

      // Event 101 exists in the seed data but has no comments.
      const response = await agent.get("/events/101/comments");

      expect(response.status).toBe(200);
      expect(response.text).toContain("No comments yet");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // POST /events/:id/comments  — submit a new comment
  // ────────────────────────────────────────────────────────────────
  describe("POST /events/:id/comments", () => {
    it("happy path: creates a comment and returns the refreshed list fragment", async () => {
      const agent = await loginAs(app, "user@app.test");

      const response = await agent
        .post("/events/1/comments")
        .type("form")
        .send({ content: "See you there!" });

      expect(response.status).toBe(200);
      expect(response.text).not.toContain("<html>");
      // New comment is present in the returned fragment.
      expect(response.text).toContain("See you there!");
      // Previous seed comments are still there too.
      expect(response.text).toContain("Looking forward to this!");
    });

    it("returns 400 when the content is empty (EmptyContent)", async () => {
      const agent = await loginAs(app, "user@app.test");

      const response = await agent
        .post("/events/1/comments")
        .type("form")
        .send({ content: "" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Comment content cannot be empty.");
    });

    it("returns 400 when the content is only whitespace (EmptyContent edge case)", async () => {
      const agent = await loginAs(app, "user@app.test");

      const response = await agent
        .post("/events/1/comments")
        .type("form")
        .send({ content: "   \n  " });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Comment content cannot be empty.");
    });

    it("rejects unauthenticated posts with 401", async () => {
      const response = await request(app)
        .post("/events/1/comments")
        .set("HX-Request", "true")
        .type("form")
        .send({ content: "drive-by comment" });

      expect(response.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // POST /events/:id/comments/:commentId/delete  — delete a comment
  // ────────────────────────────────────────────────────────────────
  describe("POST /events/:id/comments/:commentId/delete", () => {
    it("happy path: the comment author can delete their own comment", async () => {
      // user-reader authored comment-1 in the seed data.
      const agent = await loginAs(app, "user@app.test");

      const response = await agent.post("/events/1/comments/comment-1/delete");

      expect(response.status).toBe(200);
      // The deleted comment should no longer appear in the returned list.
      expect(response.text).not.toContain("Looking forward to this!");
      // The other seed comment for event 1 is still there.
      expect(response.text).toContain("Yes, snacks will be provided");
    });

    it("returns 403 when another user tries to delete a comment (UnauthorizedDeletion)", async () => {
      // staff user is neither the author (user-reader) nor the organizer
      // of event 1 (user-admin) nor an admin => should be blocked.
      const agent = await loginAs(app, "staff@app.test");

      const response = await agent.post("/events/1/comments/comment-1/delete");

      expect(response.status).toBe(403);
      expect(response.text).toContain(
        "You do not have permission to delete this comment.",
      );
    });

    it("returns 404 when the comment doesn't exist (CommentNotFound)", async () => {
      const agent = await loginAs(app, "user@app.test");

      const response = await agent.post(
        "/events/1/comments/does-not-exist/delete",
      );

      expect(response.status).toBe(404);
      expect(response.text).toContain("does-not-exist");
      expect(response.text).toContain("was not found");
    });

    it("allows an admin to delete any comment, even one they didn't author", async () => {
      // admin did not author comment-1 (user-reader did), but the admin role
      // bypasses the author/organizer check.
      const agent = await loginAs(app, "admin@app.test");

      const response = await agent.post("/events/1/comments/comment-1/delete");

      expect(response.status).toBe(200);
      expect(response.text).not.toContain("Looking forward to this!");
    });

    it("allows the event's organizer to delete another user's comment", async () => {
      // Event 2's organizerId is "user-staff" (Sam Staff). user-staff has role
      // "staff", NOT "admin", so the service's isOrganizer rule (not the
      // isAdmin rule) is what should permit the delete.

      // 1. Log in as user-reader and post a new comment on event 2.
      const reader = await loginAs(app, "user@app.test");
      const postResponse = await reader
        .post("/events/2/comments")
        .type("form")
        .send({ content: "Will there be a Q&A afterward?" });
      expect(postResponse.status).toBe(200);

      // 2. Grab the new comment's UUID from the returned list fragment.
      // Seed comments use ids like "comment-1", "comment-2", so we look for
      // a UUID-shaped id in the delete URL.
      const match = postResponse.text.match(
        /\/events\/2\/comments\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/delete/,
      );
      expect(match).not.toBeNull();
      const newCommentId = match![1];

      // 3. Log in as user-staff (the organizer of event 2) and delete it.
      const organizer = await loginAs(app, "staff@app.test");
      const deleteResponse = await organizer.post(
        `/events/2/comments/${newCommentId}/delete`,
      );

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.text).not.toContain("Will there be a Q&A afterward?");
    });
  });
});
