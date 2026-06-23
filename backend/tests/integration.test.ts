import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, createTestFile } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests
  let authToken: string;
  let userId: string;
  let familyId: string;
  let postId: string;
  let secondPostId: string; // For testing error cases that don't require post deletion
  let otherUserToken: string;
  let otherUserPostId: string; // Post created by another user (for testing 403)

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

  test("Create a family without name returns 400", async () => {
    const res = await authenticatedApi("/api/families", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("Create a family without auth returns 401", async () => {
    const res = await api("/api/families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauthorized Family" }),
    });
    await expectStatus(res, 401);
  });

  // Families - Read
  test("Get current user family", async () => {
    const res = await authenticatedApi("/api/families", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(familyId);
    expect(Array.isArray(data.members)).toBe(true);
    // Verify members include user details
    if (data.members.length > 0) {
      expect(data.members[0].user).toBeDefined();
      expect(data.members[0].user.id).toBeDefined();
      expect(data.members[0].user.name).toBeDefined();
      expect(data.members[0].user.email).toBeDefined();
    }
  });

  test("Get family without auth returns 401", async () => {
    const res = await api("/api/families");
    await expectStatus(res, 401);
  });

  // Families - Stats
  test("Get family statistics", async () => {
    const res = await authenticatedApi("/api/families/stats", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(typeof data.photos).toBe("number");
    expect(typeof data.videos).toBe("number");
    expect(typeof data.memories).toBe("number");
  });

  test("Get family stats without auth returns 401", async () => {
    const res = await api("/api/families/stats");
    await expectStatus(res, 401);
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

  test("Create a second post for error case testing", async () => {
    const res = await authenticatedApi("/api/posts", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Second test post", tags: ["test"] }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    secondPostId = data.id;
    expect(secondPostId).toBeDefined();
  });

  test("Create a post without auth returns 401", async () => {
    const res = await api("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Test" }),
    });
    await expectStatus(res, 401);
  });

  test("Create a post with empty tags array", async () => {
    const res = await authenticatedApi("/api/posts", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Post with no tags", tags: [] }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });

  test("Create a post with event_date", async () => {
    const res = await authenticatedApi("/api/posts", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_text: "Post with event date",
        event_date: "2025-06-22T10:30:00Z",
        tags: ["event"],
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });

  // Posts - Read (list)
  test("List posts", async () => {
    const res = await authenticatedApi("/api/posts", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("List posts with pagination", async () => {
    const res = await authenticatedApi("/api/posts?limit=5&offset=0", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("List posts filtered by author_id", async () => {
    const res = await authenticatedApi(`/api/posts?author_id=${userId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("List posts filtered by non-existent author_id", async () => {
    const res = await authenticatedApi("/api/posts?author_id=non-existent-id", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("List posts without auth returns 401", async () => {
    const res = await api("/api/posts");
    await expectStatus(res, 401);
  });

  // Posts - Read (single)
  test("Get a single post", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(postId);
    expect(Array.isArray(data.media)).toBe(true);
    expect(data.author).toBeDefined();
  });

  test("Get non-existent post returns 404", async () => {
    const res = await authenticatedApi(
      "/api/posts/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Get post with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/posts/invalid-uuid",
      authToken
    );
    await expectStatus(res, 400);
  });

  // Posts - Update
  test("Update a post", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}`, authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_text: "Updated post content",
        tags: ["updated", "test"],
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(postId);
  });

  test("Update post with ai_title and ai_story", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}`, authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai_title: "Updated Title",
        ai_story: "Updated Story",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update post with event_date", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}`, authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_date: "2026-01-01T12:00:00Z",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent post returns 404", async () => {
    const res = await authenticatedApi(
      "/api/posts/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: "Updated" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update post with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/posts/invalid-uuid",
      authToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: "Updated" }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Update post without auth returns 401", async () => {
    const res = await api(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Unauthorized update" }),
    });
    await expectStatus(res, 401);
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

  test("Add video media to a post", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}/media`, authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "video",
        url: "https://example.com/video.mp4",
        thumbnail_url: "https://example.com/video-thumb.jpg",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.type).toBe("video");
  });

  test("Add audio media to a post", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}/media`, authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "audio",
        url: "https://example.com/audio.mp3",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.type).toBe("audio");
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

  test("Add media with invalid type returns 400", async () => {
    const res = await authenticatedApi(`/api/posts/${postId}/media`, authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "invalid-type",
        url: "https://example.com/photo.jpg",
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

  test("Add media with invalid post UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/posts/invalid-uuid/media",
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
    await expectStatus(res, 400);
  });

  test("Add media without auth returns 401", async () => {
    const res = await api(`/api/posts/${postId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "photo",
        url: "https://example.com/photo.jpg",
      }),
    });
    await expectStatus(res, 401);
  });

  // Upload file
  test("Upload a file to S3 storage", async () => {
    const form = new FormData();
    form.append("file", createTestFile("test-upload.jpg", "test file content", "image/jpeg"));
    const res = await authenticatedApi("/api/upload-file", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.key).toBeDefined();
    expect(data.url).toBeDefined();
    expect(data.public_url).toBeDefined();
  });

  test("Upload video file to S3 storage", async () => {
    const form = new FormData();
    form.append("file", createTestFile("test-upload.mp4", "video file content", "video/mp4"));
    const res = await authenticatedApi("/api/upload-file", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.key).toBeDefined();
    expect(data.url).toBeDefined();
    expect(data.public_url).toBeDefined();
  });

  test("Upload file without auth returns 401", async () => {
    const form = new FormData();
    form.append("file", createTestFile("test-upload.jpg", "test file content", "image/jpeg"));
    const res = await api("/api/upload-file", {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 401);
  });

  test("Upload file without file returns 400", async () => {
    const form = new FormData();
    const res = await authenticatedApi("/api/upload-file", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 400, 500);
  });

  // Posts - Generate preview
  test("Generate AI preview for a post", async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/generate-preview`,
      authToken,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.ai_title).toBeDefined();
    expect(data.ai_story).toBeDefined();
  });

  test("Generate preview for non-existent post returns 404", async () => {
    const res = await authenticatedApi(
      "/api/posts/00000000-0000-0000-0000-000000000000/generate-preview",
      authToken,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 404);
  });

  test("Generate preview with invalid post UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/posts/invalid-uuid/generate-preview",
      authToken,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 400);
  });

  test("Generate preview without auth returns 401", async () => {
    const res = await api(
      `/api/posts/${postId}/generate-preview`,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 401);
  });

  test("Generate preview for another user's post returns 403", async () => {
    // Create a separate post by other user first
    const { token: token2 } = await signUpTestUser();
    // Create a family for the second user
    const familyRes = await authenticatedApi("/api/families", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Other User Family" }),
    });
    await expectStatus(familyRes, 201);

    const postRes = await authenticatedApi("/api/posts", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Other user post", tags: ["test"] }),
    });
    await expectStatus(postRes, 201);
    const otherPost = await postRes.json();

    const res = await authenticatedApi(
      `/api/posts/${otherPost.id}/generate-preview`,
      authToken,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 403);
  });

  // Posts - Publish
  test("Publish a post", async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/publish`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_title: "Test AI Title",
          ai_story: "Test AI Story",
        }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(postId);
    expect(data.ai_status).toBeDefined();
  });

  test("Publish post with missing ai_title returns 400", async () => {
    const res = await authenticatedApi(
      `/api/posts/${secondPostId}/publish`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_story: "Test AI Story",
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Publish post with missing ai_story returns 400", async () => {
    const res = await authenticatedApi(
      `/api/posts/${secondPostId}/publish`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_title: "Test AI Title",
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Publish non-existent post returns 404", async () => {
    const res = await authenticatedApi(
      "/api/posts/00000000-0000-0000-0000-000000000000/publish",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_title: "Test AI Title",
          ai_story: "Test AI Story",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Publish post with invalid post UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/posts/invalid-uuid/publish",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_title: "Test AI Title",
          ai_story: "Test AI Story",
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Publish post without auth returns 401", async () => {
    const res = await api(
      `/api/posts/${postId}/publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_title: "Test AI Title",
          ai_story: "Test AI Story",
        }),
      }
    );
    await expectStatus(res, 401);
  });

  test("Publish another user's post returns 403", async () => {
    // Create a separate post by other user for this test
    const { token: token2 } = await signUpTestUser();
    // Create a family for the second user
    const familyRes = await authenticatedApi("/api/families", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Other User Family 2" }),
    });
    await expectStatus(familyRes, 201);

    const postRes = await authenticatedApi("/api/posts", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Other user post for publish", tags: ["test"] }),
    });
    await expectStatus(postRes, 201);
    const otherPost = await postRes.json();

    const res = await authenticatedApi(
      `/api/posts/${otherPost.id}/publish`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_title: "Test AI Title",
          ai_story: "Test AI Story",
        }),
      }
    );
    await expectStatus(res, 403);
  });

  // Posts - Reactions
  test("Add reaction to a post", async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/reactions`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "👍" }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.reactions)).toBe(true);
  });

  test("Add heart reaction to a post", async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/reactions`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "❤️" }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.reactions)).toBe(true);
  });

  test("Add laugh reaction to a post", async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/reactions`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "😂" }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.reactions)).toBe(true);
  });

  test("Add reaction with missing emoji returns 400", async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/reactions`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    await expectStatus(res, 400);
  });

  test("Add reaction with invalid emoji returns 400", async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/reactions`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "🚀" }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Add reaction to non-existent post returns 404", async () => {
    const res = await authenticatedApi(
      "/api/posts/00000000-0000-0000-0000-000000000000/reactions",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "👍" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Add reaction with invalid post UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/posts/invalid-uuid/reactions",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "👍" }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Add reaction without auth returns 401", async () => {
    const res = await api(
      `/api/posts/${postId}/reactions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "👍" }),
      }
    );
    await expectStatus(res, 401);
  });

  test("Add reaction to another user's post returns 403", async () => {
    const { token: token2 } = await signUpTestUser();
    // Create a family for the second user
    const familyRes = await authenticatedApi("/api/families", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Other User Family 3" }),
    });
    await expectStatus(familyRes, 201);

    const postRes = await authenticatedApi("/api/posts", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Other user post for reaction", tags: ["test"] }),
    });
    await expectStatus(postRes, 201);
    const otherPost = await postRes.json();

    const res = await authenticatedApi(
      `/api/posts/${otherPost.id}/reactions`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "👍" }),
      }
    );
    await expectStatus(res, 403);
  });

  test("Remove reaction from a post", async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/reactions`,
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.reactions)).toBe(true);
  });

  test("Remove reaction from non-existent post returns 404", async () => {
    const res = await authenticatedApi(
      "/api/posts/00000000-0000-0000-0000-000000000000/reactions",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Remove reaction with invalid post UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/posts/invalid-uuid/reactions",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 400);
  });

  test("Remove reaction without auth returns 401", async () => {
    const res = await api(
      `/api/posts/${postId}/reactions`,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 401);
  });

  test("Remove reaction from another user's post returns 403", async () => {
    const { token: token2 } = await signUpTestUser();
    // Create a family for the second user
    const familyRes = await authenticatedApi("/api/families", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Other User Family 4" }),
    });
    await expectStatus(familyRes, 201);

    const postRes = await authenticatedApi("/api/posts", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Other user post for remove reaction", tags: ["test"] }),
    });
    await expectStatus(postRes, 201);
    const otherPost = await postRes.json();

    const res = await authenticatedApi(
      `/api/posts/${otherPost.id}/reactions`,
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  // Posts - Delete
  test("Delete a post", async () => {
    const res = await authenticatedApi(`/api/posts/${secondPostId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Get deleted post returns 404", async () => {
    const res = await authenticatedApi(`/api/posts/${secondPostId}`, authToken);
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

  test("Delete post with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/posts/invalid-uuid",
      authToken,
      { method: "DELETE" }
    );
    await expectStatus(res, 400);
  });

  test("Delete post without auth returns 401", async () => {
    const { token: token2 } = await signUpTestUser();
    // Create a family for the second user
    const familyRes = await authenticatedApi("/api/families", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Other User Family 5" }),
    });
    await expectStatus(familyRes, 201);

    const postRes = await authenticatedApi("/api/posts", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Post for delete auth test", tags: ["test"] }),
    });
    await expectStatus(postRes, 201);
    const testPost = await postRes.json();

    const res = await api(`/api/posts/${testPost.id}`, {
      method: "DELETE",
    });
    await expectStatus(res, 401);
  });

  test("Delete another user's post returns 403", async () => {
    const { token: token2 } = await signUpTestUser();
    // Create a family for the second user
    const familyRes = await authenticatedApi("/api/families", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Other User Family 6" }),
    });
    await expectStatus(familyRes, 201);

    const postRes = await authenticatedApi("/api/posts", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Other user post for delete", tags: ["test"] }),
    });
    await expectStatus(postRes, 201);
    const otherPost = await postRes.json();

    const res = await authenticatedApi(`/api/posts/${otherPost.id}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 403);
  });

  // Families - Join
  test("Join family with valid invite code", async () => {
    // Create a second user to test joining
    const { token: token2 } = await signUpTestUser();
    otherUserToken = token2; // Save for later use

    // Have the new user create a family
    const familyRes = await authenticatedApi("/api/families", token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Family 2" }),
    });
    await expectStatus(familyRes, 201);
    const family2Data = await familyRes.json();
    const inviteCode = family2Data.invite_code;

    // Have first user join via invite code
    const joinRes = await authenticatedApi("/api/families/join", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    await expectStatus(joinRes, 200);
    const joinData = await joinRes.json();
    expect(joinData.id).toBe(family2Data.id);
  });

  test("Join family with invalid invite code returns 404", async () => {
    const res = await authenticatedApi("/api/families/join", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: "invalid-code-xyz" }),
    });
    await expectStatus(res, 404);
  });

  test("Join family without auth returns 401", async () => {
    const res = await api("/api/families/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: "some-code" }),
    });
    await expectStatus(res, 401);
  });

  test("Join family with missing invite_code returns 400", async () => {
    const res = await authenticatedApi("/api/families/join", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  // Memories
  test("Get today's memories", async () => {
    const res = await authenticatedApi("/api/memories/today", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.memories)).toBe(true);
  });

  test("Get memories without auth returns 401", async () => {
    const res = await api("/api/memories/today");
    await expectStatus(res, 401);
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

  test("Get timeline with invalid year (negative)", async () => {
    const res = await authenticatedApi("/api/timeline?year=-1", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.groups)).toBe(true);
  });

  test("Get timeline without auth returns 401", async () => {
    const res = await api("/api/timeline");
    await expectStatus(res, 401);
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

  test("Partial update user profile (name only)", async () => {
    const res = await authenticatedApi("/api/profile", authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Partial Update Name",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.name).toBe("Partial Update Name");
    expect(data.email).toBeDefined();
  });

  test("Partial update user profile (avatar_url only)", async () => {
    const res = await authenticatedApi("/api/profile", authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        avatar_url: "https://example.com/new-avatar.jpg",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.image).toBeDefined();
  });

  test("Get profile without auth returns 401", async () => {
    const res = await api("/api/profile");
    await expectStatus(res, 401);
  });

  test("Update profile without auth returns 401", async () => {
    const res = await api("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unauthorized Update",
      }),
    });
    await expectStatus(res, 401);
  });

  // Profile - Push token
  test("Save push token", async () => {
    const res = await authenticatedApi("/api/profile/push-token", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "ExponentPushToken[test-token-abc123]",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Save push token with missing token returns 400", async () => {
    const res = await authenticatedApi("/api/profile/push-token", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("Save push token without auth returns 401", async () => {
    const res = await api("/api/profile/push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "ExponentPushToken[test-token-abc123]",
      }),
    });
    await expectStatus(res, 401);
  });

  // Profile - Birthday
  test("Update user birthday", async () => {
    const res = await authenticatedApi("/api/profile/birthday", authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthday: "1990-05-15" }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Update birthday with missing birthday returns 400", async () => {
    const res = await authenticatedApi("/api/profile/birthday", authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("Update birthday without auth returns 401", async () => {
    const res = await api("/api/profile/birthday", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthday: "1990-05-15" }),
    });
    await expectStatus(res, 401);
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
    expect(data.family_id).toBeDefined();
    expect(data.generated_at).toBeDefined();
  });

  test("Generate newsletter with missing month returns 400", async () => {
    const res = await authenticatedApi("/api/newsletter/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2026 }),
    });
    await expectStatus(res, 400);
  });

  test("Generate newsletter with missing year returns 400", async () => {
    const res = await authenticatedApi("/api/newsletter/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: 6 }),
    });
    await expectStatus(res, 400);
  });

  test("Generate newsletter with invalid month (13) returns 400", async () => {
    const res = await authenticatedApi("/api/newsletter/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: 13, year: 2026 }),
    });
    await expectStatus(res, 400, 200);
  });

  test("Generate newsletter with invalid month (0) returns 400", async () => {
    const res = await authenticatedApi("/api/newsletter/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: 0, year: 2026 }),
    });
    await expectStatus(res, 400, 200);
  });

  test("Get latest newsletter", async () => {
    const res = await authenticatedApi("/api/newsletter/latest", authToken);
    await expectStatus(res, 200, 404);
  });

  test("Generate newsletter without auth returns 401", async () => {
    const res = await api("/api/newsletter/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: 6, year: 2026 }),
    });
    await expectStatus(res, 401);
  });

  test("Get latest newsletter without auth returns 401", async () => {
    const res = await api("/api/newsletter/latest");
    await expectStatus(res, 401);
  });

  // Auth - Token
  test("Get JWT token from session cookie", async () => {
    const res = await authenticatedApi("/api/auth/token", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(typeof data.token).toBe("string");
  });

  test("Get token without auth returns 401", async () => {
    const res = await api("/api/auth/token");
    await expectStatus(res, 401);
  });

  // Feed
  test("Get family feed", async () => {
    const res = await authenticatedApi("/api/feed", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Get family feed without auth returns 401", async () => {
    const res = await api("/api/feed");
    await expectStatus(res, 401);
  });
});
