import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, ne, desc, inArray, count } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import { resolveMediaUrl } from '../lib/storage-utils.js';

const ALL_EMOJIS = ['👍', '❤️', '😂'] as const;

async function getReactionsByPostId(
  app: App,
  postIds: string[],
  userId: string
): Promise<Map<string, { emoji: string; count: number; userReacted: boolean }[]>> {
  const result = new Map<string, { emoji: string; count: number; userReacted: boolean }[]>();
  if (postIds.length === 0) return result;

  const rows = await app.db
    .select()
    .from(schema.post_reactions)
    .where(inArray(schema.post_reactions.post_id, postIds));

  const byPost = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byPost.has(r.post_id)) byPost.set(r.post_id, []);
    byPost.get(r.post_id)!.push(r);
  }

  for (const postId of postIds) {
    const postRows = byPost.get(postId) || [];
    result.set(
      postId,
      ALL_EMOJIS.map((emoji) => ({
        emoji,
        count: postRows.filter((r) => r.emoji === emoji).length,
        userReacted: postRows.some((r) => r.emoji === emoji && r.user_id === userId),
      }))
    );
  }

  return result;
}

export function registerPostsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get(
    '/api/posts',
    {
      schema: {
        description: 'List posts for user family with pagination',
        tags: ['posts'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 20 },
            offset: { type: 'integer', default: 0 },
            author_id: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                family_id: { type: 'string', format: 'uuid' },
                author_id: { type: 'string' },
                raw_text: { type: ['string', 'null'] },
                ai_title: { type: ['string', 'null'] },
                ai_story: { type: ['string', 'null'] },
                ai_status: { type: 'string' },
                event_date: { type: ['string', 'null'], format: 'date-time' },
                tags: { type: ['array', 'null'], items: { type: 'string' } },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
                media_count: { type: 'integer' },
                author: {
                  type: 'object',
                  additionalProperties: true,
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    image: { type: ['string', 'null'] },
                  },
                },
                media: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      post_id: { type: 'string', format: 'uuid' },
                      family_id: { type: 'string', format: 'uuid' },
                      uploader_id: { type: 'string' },
                      type: { type: 'string' },
                      url: { type: 'string' },
                      thumbnail_url: { type: ['string', 'null'] },
                      created_at: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                reactions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      emoji: { type: 'string' },
                      count: { type: 'integer' },
                      userReacted: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { limit?: string; offset?: string; author_id?: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
      const offset = parseInt(request.query.offset || '0', 10);
      const authorIdFilter = request.query.author_id;

      app.logger.info({ userId: session.user.id, limit, offset, authorIdFilter }, 'Fetching posts');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const postsData = await app.db
        .select()
        .from(schema.posts)
        .where(
          authorIdFilter
            ? and(
                eq(schema.posts.family_id, familyMember[0].family_id),
                eq(schema.posts.author_id, authorIdFilter)
              )
            : eq(schema.posts.family_id, familyMember[0].family_id)
        )
        .orderBy(desc(schema.posts.created_at))
        .limit(limit)
        .offset(offset);

      const totalResult = await app.db
        .select({ count: count() })
        .from(schema.posts)
        .where(
          authorIdFilter
            ? and(
                eq(schema.posts.family_id, familyMember[0].family_id),
                eq(schema.posts.author_id, authorIdFilter)
              )
            : eq(schema.posts.family_id, familyMember[0].family_id)
        );

      // Batch query all unique author IDs
      const authorIds = [...new Set(postsData.map((p) => p.author_id))];
      const authors = await app.db
        .select()
        .from(authSchema.user)
        .where(inArray(authSchema.user.id, authorIds));
      const authorMap = new Map(authors.map((a) => [a.id, a]));

      // Batch query all media for all posts
      const postIds = postsData.map((p) => p.id);
      const allMedia = await app.db
        .select()
        .from(schema.media)
        .where(inArray(schema.media.post_id, postIds));

      // Group media by post_id
      const mediaByPostId = new Map<string, typeof allMedia>();
      for (const m of allMedia) {
        if (!mediaByPostId.has(m.post_id)) {
          mediaByPostId.set(m.post_id, []);
        }
        mediaByPostId.get(m.post_id)!.push(m);
      }

      const reactionsByPostId = await getReactionsByPostId(app, postIds, session.user.id);

      const postsWithDetails = await Promise.all(
        postsData.map(async (p) => {
          const author = authorMap.get(p.author_id);
          const mediaRows = mediaByPostId.get(p.id) || [];

          app.logger.info({ postId: p.id, author_id: p.author_id }, `author_id being returned: ${p.author_id}`);

          return {
            ...p,
            author: {
              id: p.author_id,
              name: author?.name || '',
              image: author?.image || null,
            },
            media_count: mediaRows.length,
            media: await Promise.all(
              mediaRows.map(async (m) => ({
                id: m.id,
                post_id: m.post_id,
                family_id: m.family_id,
                uploader_id: m.uploader_id,
                type: m.type,
                url: await resolveMediaUrl(app.storage, m.url, m.storage_key),
                thumbnail_url: await resolveMediaUrl(app.storage, m.thumbnail_url, m.thumbnail_key),
                created_at: m.created_at,
              }))
            ),
            reactions: reactionsByPostId.get(p.id) || ALL_EMOJIS.map((emoji) => ({ emoji, count: 0, userReacted: false })),
          };
        })
      );

      app.logger.info({ count: postsWithDetails.length, total: totalResult[0]?.count ?? 0 }, 'Posts retrieved');

      const firstPostMedia = postIds.length > 0 ? (mediaByPostId.get(postIds[0]) ?? []) : [];
      app.logger.info({ firstPostMedia }, '[Posts] post[0] media');

      return postsWithDetails;
    }
  );

  app.fastify.post(
    '/api/posts',
    {
      schema: {
        description: 'Create a new post',
        tags: ['posts'],
        body: {
          type: 'object',
          properties: {
            raw_text: { type: 'string' },
            event_date: { type: 'string', format: 'date-time' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              ai_status: { type: 'string' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { raw_text?: string; event_date?: string; tags?: string[] } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Creating post');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const eventDate = request.body.event_date ? new Date(request.body.event_date) : null;

      const post = await app.db
        .insert(schema.posts)
        .values({
          family_id: familyMember[0].family_id,
          author_id: session.user.id,
          raw_text: request.body.raw_text || null,
          event_date: eventDate,
          tags: request.body.tags || [],
          ai_status: 'pending',
        })
        .returning();

      const [createdPost] = post;

      app.logger.info({ postId: createdPost.id }, 'Post created with pending status');

      reply.status(201);
      return createdPost;
    }
  );

  app.fastify.get(
    '/api/posts/:id',
    {
      schema: {
        description: 'Get a single post with all media',
        tags: ['posts'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
            properties: {
              id: { type: 'string', format: 'uuid' },
              family_id: { type: 'string', format: 'uuid' },
              author_id: { type: 'string' },
              raw_text: { type: ['string', 'null'] },
              ai_title: { type: ['string', 'null'] },
              ai_story: { type: ['string', 'null'] },
              ai_status: { type: 'string' },
              event_date: { type: ['string', 'null'], format: 'date-time' },
              tags: { type: 'array', items: { type: 'string' } },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
              author: {
                type: 'object',
                additionalProperties: true,
                properties: { id: { type: 'string' }, name: { type: 'string' }, image: { type: ['string', 'null'] } },
              },
              media: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    post_id: { type: 'string', format: 'uuid' },
                    family_id: { type: 'string', format: 'uuid' },
                    uploader_id: { type: 'string' },
                    type: { type: 'string' },
                    url: { type: 'string' },
                    thumbnail_url: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      app.logger.info({ postId: request.params.id }, 'Fetching post');

      const post = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, request.params.id))
        .limit(1);

      if (!post.length) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      const author = await app.db
        .select()
        .from(authSchema.user)
        .where(eq(authSchema.user.id, post[0].author_id))
        .limit(1);

      const mediaRows = await app.db
        .select()
        .from(schema.media)
        .where(eq(schema.media.post_id, post[0].id));

      app.logger.info({ postId: post[0].id, author_id: post[0].author_id }, `author_id being returned: ${post[0].author_id}`);

      return {
        ...post[0],
        author: {
          id: post[0].author_id,
          name: author[0].name,
          image: author[0].image,
        },
        media: await Promise.all(
          mediaRows.map(async (m) => ({
            id: m.id,
            post_id: m.post_id,
            family_id: m.family_id,
            uploader_id: m.uploader_id,
            type: m.type,
            url: await resolveMediaUrl(app.storage, m.url, m.storage_key),
            thumbnail_url: await resolveMediaUrl(app.storage, m.thumbnail_url, m.thumbnail_key),
            created_at: m.created_at,
          }))
        ),
      };
    }
  );

  app.fastify.delete(
    '/api/posts/:id',
    {
      schema: {
        description: 'Delete a post',
        tags: ['posts'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await app.requireAuth()(request, reply);
      if (!session) return;

      app.logger.info({ postId: request.params.id, userId: session.user.id }, 'Deleting post');

      const post = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, request.params.id))
        .limit(1);

      if (!post.length) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      const isAuthor = post[0].author_id === session.user.id;

      if (!isAuthor) {
        const familyMember = await app.db
          .select()
          .from(schema.family_members)
          .where(
            and(
              eq(schema.family_members.user_id, session.user.id),
              eq(schema.family_members.family_id, post[0].family_id)
            )
          )
          .limit(1);

        const isAdmin = familyMember.length && familyMember[0].role === 'admin';

        if (!isAdmin) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }

      await app.db.delete(schema.posts).where(eq(schema.posts.id, request.params.id));

      app.logger.info({ postId: request.params.id }, 'Post deleted');

      return { success: true };
    }
  );

  app.fastify.patch(
    '/api/posts/:id',
    {
      schema: {
        description: 'Update a post (author only)',
        tags: ['posts'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            ai_title: { type: 'string' },
            ai_story: { type: 'string' },
            raw_text: { type: 'string' },
            event_date: { type: 'string', format: 'date-time' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { ai_title?: string; ai_story?: string; raw_text?: string; event_date?: string; tags?: string[] };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ postId: request.params.id, userId: session.user.id }, 'Updating post');

      const post = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, request.params.id))
        .limit(1);

      if (!post.length) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      if (post[0].author_id !== session.user.id) {
        app.logger.warn({ postId: request.params.id, userId: session.user.id }, 'Unauthorized post update attempt');
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (request.body.ai_title !== undefined) updates.ai_title = request.body.ai_title;
      if (request.body.ai_story !== undefined) updates.ai_story = request.body.ai_story;
      if (request.body.raw_text !== undefined) updates.raw_text = request.body.raw_text;
      if (request.body.tags !== undefined) updates.tags = request.body.tags;
      if (request.body.event_date !== undefined) updates.event_date = new Date(request.body.event_date);

      const updated = await app.db
        .update(schema.posts)
        .set(updates)
        .where(eq(schema.posts.id, request.params.id))
        .returning();

      app.logger.info({ postId: updated[0].id }, 'Post updated successfully');

      return updated[0];
    }
  );

  app.fastify.post(
    '/api/posts/:id/generate-preview',
    {
      schema: {
        description: 'Generate AI preview for a post',
        tags: ['posts'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ai_title: { type: 'string' },
              ai_story: { type: 'string' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ postId: request.params.id, userId: session.user.id }, 'Generating post preview');

      const post = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, request.params.id))
        .limit(1);

      if (!post.length) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      if (post[0].author_id !== session.user.id) {
        app.logger.warn({ postId: request.params.id, userId: session.user.id }, 'Unauthorized preview generation attempt');
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Load related media from database
      const mediaRows = await app.db
        .select()
        .from(schema.media)
        .where(eq(schema.media.post_id, post[0].id));

      app.logger.info({ postId: request.params.id, mediaCount: mediaRows.length }, 'Loaded media from database');
      if (mediaRows.length > 0) {
        app.logger.info({ firstMediaRow: mediaRows[0] }, 'First media row');
      }

      if (!process.env.OPENROUTER_API_KEY) {
        return reply.status(500).send({ error: 'OPENROUTER_API_KEY not configured' });
      }

      try {
        const systemPrompt = `Du bist ein Familientagebuch-Assistent. Schreibe einen kurzen, warmen Eintrag auf Deutsch.
Halte dich strikt an die genannten Fakten – erfinde nichts dazu.
Maximal 40 Wörter für die Geschichte. Ton: persönlich und herzlich, wie ein Tagebucheintrag – nicht poetisch.
Antworte ausschließlich als JSON: {"title": "...", "story": "..."}`;

        const userText = post[0].raw_text || '';
        const fullPrompt = `${systemPrompt}\n\nText zum Verbessern:\n${userText}`;

        // Determine if we have image media
        const hasImage = mediaRows.length > 0 && !!mediaRows[0].url;
        if (hasImage) {
          app.logger.info({ postId: request.params.id, imageUrl: mediaRows[0].url }, 'Using image from media');
        }

        app.logger.info({ postId: request.params.id, hasImage }, 'Calling AI with vision');

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: fullPrompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          app.logger.error({ status: response.status, error: errorText }, 'OpenRouter API error');
          return reply.status(500).send({ error: `OpenRouter API error: ${response.status}` });
        }

        const data = await response.json() as { choices: Array<{ message: { content: string } }> };
        const content = data.choices[0].message.content;
        app.logger.info({ postId: request.params.id, rawContent: content.slice(0, 500) }, 'Raw AI response');

        // Strip markdown code fences if present
        const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        let parsed;
        try {
          parsed = JSON.parse(cleaned);
        } catch (parseError) {
          app.logger.error({ rawContent: content }, 'JSON parse failed');
          return reply.status(500).send({ error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` });
        }

        // Enforce length limits
        const aiTitle = (parsed.title || 'Mein Moment').substring(0, 40);
        const storyRaw = parsed.story || post[0].raw_text || '';
        const storyWords = storyRaw.trim().split(/\s+/);
        const aiStory = storyWords.slice(0, 60).join(' ');

        app.logger.info({ postId: request.params.id, titleLen: aiTitle.length, storyLen: aiStory.length }, 'Preview generated successfully');

        return {
          ai_title: aiTitle,
          ai_story: aiStory,
        };
      } catch (error) {
        app.logger.error({ err: error, postId: request.params.id }, 'Unexpected error during preview generation');
        return reply.status(500).send({ error: `Preview generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
      }
    }
  );

  app.fastify.post(
    '/api/posts/:id/generate-ai',
    {
      schema: {
        description: 'Generate AI content for a post using raw_text',
        tags: ['posts'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ai_title: { type: 'string' },
              ai_story: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ postId: request.params.id, userId: session.user.id }, 'Generating AI content for post');

      // Look up the post
      const post = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, request.params.id))
        .limit(1);

      if (!post.length) {
        app.logger.warn({ postId: request.params.id }, 'Post not found');
        return reply.status(404).send({ error: 'Post not found' });
      }

      // Verify user is the author of the post
      if (post[0].author_id !== session.user.id) {
        app.logger.warn({ postId: request.params.id, userId: session.user.id }, 'Unauthorized AI generation attempt');
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Verify user has access to this post's family (double-check)
      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(
          and(
            eq(schema.family_members.user_id, session.user.id),
            eq(schema.family_members.family_id, post[0].family_id)
          )
        )
        .limit(1);

      if (!familyMember.length) {
        app.logger.warn({ postId: request.params.id, userId: session.user.id }, 'User not in post family');
        return reply.status(404).send({ error: 'Post not found' });
      }

      // Check if raw_text is provided
      if (!post[0].raw_text || post[0].raw_text.trim() === '') {
        app.logger.warn({ postId: request.params.id }, 'raw_text is empty');
        return reply.status(400).send({ error: 'raw_text is required' });
      }

      // Set ai_status to 'generating'
      await app.db
        .update(schema.posts)
        .set({
          ai_status: 'generating',
          updated_at: new Date(),
        })
        .where(eq(schema.posts.id, request.params.id));

      app.logger.info({ postId: request.params.id }, 'Set ai_status to generating');

      try {
        if (!process.env.OPENROUTER_API_KEY) {
          app.logger.error({}, 'OPENROUTER_API_KEY not configured');
          await app.db
            .update(schema.posts)
            .set({
              ai_status: 'error',
              updated_at: new Date(),
            })
            .where(eq(schema.posts.id, request.params.id));
          return reply.status(500).send({ error: 'AI generation failed' });
        }

        const systemPrompt = 'Du bist ein Assistent der Familienerinnerungen formuliert. Deine Aufgabe: Formuliere den eingegebenen Text als kurzen, persönlichen Satz oder zwei – maximal dreimal so lang wie die Eingabe. Keine Ausschmückungen, kein Auffüllen. Schreib so, als würde ein Familienmitglied die Erinnerung erzählen – warm, direkt, echt. Behalte alle persönlichen Details bei. Antworte immer in der Sprache der Eingabe.';
        const userMessage = `Eingabe: "${post[0].raw_text}"\n\nErstelle:\n1. Einen kurzen Titel (max. 6 Wörter)\n2. Einen kurzen, persönlichen Text (max. 3 Sätze, nicht länger als das Dreifache der Eingabe)\n\nAntworte als JSON: {"title": "...", "story": "..."}`;

        app.logger.info({ postId: request.params.id }, 'Calling OpenRouter API for AI generation');

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: userMessage,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          app.logger.error({ status: response.status, error: errorText, postId: request.params.id }, 'OpenRouter API error');
          await app.db
            .update(schema.posts)
            .set({
              ai_status: 'error',
              updated_at: new Date(),
            })
            .where(eq(schema.posts.id, request.params.id));
          return reply.status(500).send({ error: 'AI generation failed' });
        }

        const data = await response.json() as { choices: Array<{ message: { content: string } }> };
        const content = data.choices[0].message.content;
        app.logger.info({ postId: request.params.id, rawContent: content.slice(0, 500) }, 'Raw AI response');

        // Strip markdown code fences if present
        const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        let parsed;
        try {
          parsed = JSON.parse(cleaned);
        } catch (parseError) {
          app.logger.error({ rawContent: content, postId: request.params.id }, 'JSON parse failed');
          await app.db
            .update(schema.posts)
            .set({
              ai_status: 'error',
              updated_at: new Date(),
            })
            .where(eq(schema.posts.id, request.params.id));
          return reply.status(500).send({ error: 'AI generation failed' });
        }

        const aiTitle = parsed.title || '';
        const aiStory = parsed.story || '';

        app.logger.info({ postId: request.params.id, titleLen: aiTitle.length, storyLen: aiStory.length }, 'AI content generated successfully');

        // Update post with AI content and set status to 'done'
        const updated = await app.db
          .update(schema.posts)
          .set({
            ai_title: aiTitle,
            ai_story: aiStory,
            ai_status: 'done',
            updated_at: new Date(),
          })
          .where(eq(schema.posts.id, request.params.id))
          .returning();

        app.logger.info({ postId: updated[0].id }, 'Post AI generation completed successfully');

        return {
          ai_title: aiTitle,
          ai_story: aiStory,
        };
      } catch (error) {
        app.logger.error({ err: error, postId: request.params.id }, 'Unexpected error during AI generation');
        await app.db
          .update(schema.posts)
          .set({
            ai_status: 'error',
            updated_at: new Date(),
          })
          .where(eq(schema.posts.id, request.params.id));
        return reply.status(500).send({ error: 'AI generation failed' });
      }
    }
  );

  app.fastify.post(
    '/api/posts/:id/publish',
    {
      schema: {
        description: 'Publish a draft post with AI content',
        tags: ['posts'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['ai_title', 'ai_story'],
          properties: {
            ai_title: { type: 'string' },
            ai_story: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              ai_status: { type: 'string' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { ai_title: string; ai_story: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ postId: request.params.id, userId: session.user.id }, 'Publishing post');

      const post = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, request.params.id))
        .limit(1);

      if (!post.length) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      if (post[0].author_id !== session.user.id) {
        app.logger.warn({ postId: request.params.id, userId: session.user.id }, 'Unauthorized publish attempt');
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const updated = await app.db
        .update(schema.posts)
        .set({
          ai_title: request.body.ai_title,
          ai_story: request.body.ai_story,
          ai_status: 'published',
          updated_at: new Date(),
        })
        .where(eq(schema.posts.id, request.params.id))
        .returning();

      const [publishedPost] = updated;

      app.logger.info({ postId: publishedPost.id }, 'Post published successfully');

      try {
        const family = await app.db
          .select()
          .from(schema.families)
          .where(eq(schema.families.id, publishedPost.family_id))
          .limit(1);

        const otherMembers = await app.db
          .select()
          .from(schema.family_members)
          .where(
            and(
              eq(schema.family_members.family_id, publishedPost.family_id),
              ne(schema.family_members.user_id, publishedPost.author_id)
            )
          );

        const otherMemberIds = otherMembers.map((m) => m.user_id);
        const recipients = otherMemberIds.length
          ? await app.db
              .select()
              .from(authSchema.user)
              .where(inArray(authSchema.user.id, otherMemberIds))
          : [];

        const messages = recipients
          .filter((r) => !!r.push_token)
          .map((r) => ({
            to: r.push_token,
            title: family[0]?.name || 'Famly',
            body: `${session.user.name} hat einen neuen Moment geteilt: ${publishedPost.ai_title}`,
            data: { postId: publishedPost.id },
          }));

        if (messages.length > 0) {
          app.logger.info(
            { postId: publishedPost.id, recipientCount: messages.length },
            'Sending push notifications to family members'
          );
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'Accept-Encoding': 'gzip, deflate',
            },
            body: JSON.stringify(messages),
          });
        }
      } catch (error) {
        app.logger.error({ err: error, postId: publishedPost.id }, 'Failed to send push notifications');
      }

      return publishedPost;
    }
  );

  const reactionResponseSchema = {
    200: {
      type: 'object',
      properties: {
        reactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              emoji: { type: 'string' },
              count: { type: 'integer' },
              userReacted: { type: 'boolean' },
            },
          },
        },
      },
    },
    401: { type: 'object', properties: { error: { type: 'string' } } },
    403: { type: 'object', properties: { error: { type: 'string' } } },
    404: { type: 'object', properties: { error: { type: 'string' } } },
  } as const;

  async function checkFamilyAccessToPost(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply, session: { user: { id: string } }) {
    const post = await app.db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, request.params.id))
      .limit(1);

    if (!post.length) {
      reply.status(404).send({ error: 'Post not found' });
      return null;
    }

    const familyMember = await app.db
      .select()
      .from(schema.family_members)
      .where(
        and(
          eq(schema.family_members.user_id, session.user.id),
          eq(schema.family_members.family_id, post[0].family_id)
        )
      )
      .limit(1);

    if (!familyMember.length) {
      reply.status(403).send({ error: 'Forbidden' });
      return null;
    }

    return post[0];
  }

  app.fastify.post(
    '/api/posts/:id/reactions',
    {
      schema: {
        description: "Set (or replace) the caller's reaction on a post",
        tags: ['posts'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['emoji'],
          properties: { emoji: { type: 'string', enum: ALL_EMOJIS as unknown as string[] } },
        },
        response: reactionResponseSchema,
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { emoji: typeof ALL_EMOJIS[number] } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const post = await checkFamilyAccessToPost(request, reply, session);
      if (!post) return;

      await app.db
        .delete(schema.post_reactions)
        .where(
          and(
            eq(schema.post_reactions.post_id, request.params.id),
            eq(schema.post_reactions.user_id, session.user.id)
          )
        );

      await app.db.insert(schema.post_reactions).values({
        post_id: request.params.id,
        user_id: session.user.id,
        emoji: request.body.emoji,
      });

      app.logger.info(
        { postId: request.params.id, userId: session.user.id, emoji: request.body.emoji },
        'Reaction set'
      );

      const reactionsMap = await getReactionsByPostId(app, [request.params.id], session.user.id);
      return { reactions: reactionsMap.get(request.params.id) || [] };
    }
  );

  app.fastify.delete(
    '/api/posts/:id/reactions',
    {
      schema: {
        description: "Remove the caller's reaction from a post",
        tags: ['posts'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: reactionResponseSchema,
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const post = await checkFamilyAccessToPost(request, reply, session);
      if (!post) return;

      await app.db
        .delete(schema.post_reactions)
        .where(
          and(
            eq(schema.post_reactions.post_id, request.params.id),
            eq(schema.post_reactions.user_id, session.user.id)
          )
        );

      app.logger.info({ postId: request.params.id, userId: session.user.id }, 'Reaction removed');

      const reactionsMap = await getReactionsByPostId(app, [request.params.id], session.user.id);
      return { reactions: reactionsMap.get(request.params.id) || [] };
    }
  );
}
