import { describe, test, expect } from "bun:test";
import { authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests
  let authToken: string;
  let userId: string;
  let familyId: string;
  let postId: string;

  // Auth setup
  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    userId = user.id;
    expect(authToken).toBeDefined();
  });

  // Families - Create
  test("Create a family", async () => {
    const res = await authenticatedApi("/api/families", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Family" }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    familyId = data.id;
    expect(familyId).toBeDefined();
    expect(data.invite_code).toBeDefined();
  });

  // Families - Read
  test("Get current user family", async () => {
    const res = await authenticatedApi("/api/families", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(familyId);
    expect(Array.isArray(data.members)).toBe(true);
  });

  // Posts - Create
  test("Create a post", async () => {
    const res = await authenticatedApi("/api/posts", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Test post content", tags: ["test"] }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    postId = data.id;
    expect(postId).toBeDefined();
  });

  // Posts - Read (list)
  test("List posts", async () => {
    const res = await authenticatedApi("/api/posts", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.posts)).toBe(true);
    expect(typeof data.total).toBe("number");
  });

  test("List posts with pagination", async () => {
    const res = await authenticatedApi("/api/posts?limit=5&offset=0", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.posts)).toBe(true);
  });

  // Posts - Read (single)
  test("Get a single post", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(postId);
    expect(Array.isArray(data.media)).toBe(true);
  });

  test("Get non-existent post returns 404", async () => {
    const res = await authenticatedApi(
      "/api/posts/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  // Media - Create
  test("Add media to a post", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}/media`, authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "photo",
        url: "https://example.com/photo.jpg",
        thumbnail_url: "https://example.com/photo-thumb.jpg",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.post_id).toBe(postId);
    expect(data.type).toBe("photo");
  });

  test("Add media with missing type returns 400", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}/media`, authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/photo.jpg",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Add media with missing url returns 400", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}/media`, authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "photo",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Add media to non-existent post returns 404", async () => {
    const res = await authenticatedApi(
      "/api/posts/00000000-0000-0000-0000-000000000000/media",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "photo",
          url: "https://example.com/photo.jpg",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  // Upload URL
  test("Get signed upload URL", async () => {
    const res = await authenticatedApi("/api/upload-url", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "test.jpg",
        content_type: "image/jpeg",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.upload_url).toBeDefined();
    expect(data.public_url).toBeDefined();
  });

  test("Get upload URL with missing filename returns 400", async () => {
    const res = await authenticatedApi("/api/upload-url", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_type: "image/jpeg",
      }),
    });
    await expectStatus(res, 400);
  });

  // Posts - Delete
  test("Delete a post", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Get deleted post returns 404", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}`, authToken);
    await expectStatus(res, 404);
  });

  test("Delete non-existent post returns 404", async () => {
    const res = await authenticatedApi(
      "/api/posts/00000000-0000-0000-0000-000000000000",
      authToken,
      { method: "DELETE" }
    );
    await expectStatus(res, 404);
  });

  // Families - Join
  test("Join family with invalid invite code returns 404", async () => {
    const res = await authenticatedApi("/api/families/join", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: "invalid-code-xyz" }),
    });
    await expectStatus(res, 404);
  });

  // Memories
  test("Get today's memories", async () => {
    const res = await authenticatedApi("/api/memories/today", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.memories)).toBe(true);
  });

  // Timeline
  test("Get timeline", async () => {
    const res = await authenticatedApi("/api/timeline", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.groups)).toBe(true);
  });

  test("Get timeline filtered by year", async () => {
    const res = await authenticatedApi("/api/timeline?year=2026", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.groups)).toBe(true);
  });

  // Profile
  test("Get current user profile", async () => {
    const res = await authenticatedApi("/api/profile", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(userId);
    expect(data.email).toBeDefined();
    expect(data.name).toBeDefined();
  });

  test("Update user profile", async () => {
    const res = await authenticatedApi("/api/profile", authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Test Name",
        avatar_url: "https://example.com/avatar.jpg",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.name).toBe("Updated Test Name");
  });

  // Newsletter
  test("Generate newsletter", async () => {
    const res = await authenticatedApi("/api/newsletter/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: 6, year: 2026 }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.month).toBe(6);
    expect(data.year).toBe(2026);
  });

  test("Get latest newsletter", async () => {
    const res = await authenticatedApi("/api/newsletter/latest", authToken);
    await expectStatus(res, 200);
  });
});
