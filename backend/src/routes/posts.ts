import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

async function generateAIStory(app: App, post: any): Promise<void> {
  try {
    await app.db
      .update(schema.posts)
      .set({ ai_status: 'processing' })
      .where(eq(schema.posts.id, post.id));

    if (!process.env.OPENROUTER_API_KEY) {
      app.logger.warn({ postId: post.id }, 'OPENROUTER_API_KEY not set, skipping AI generation');
      await app.db
        .update(schema.posts)
        .set({ ai_status: 'done' })
        .where(eq(schema.posts.id, post.id));
      return;
    }

    const tags = Array.isArray(post.tags) ? post.tags : [];
    const eventDate = post.event_date ? new Date(post.event_date).toISOString().split('T')[0] : 'No date';

    const userPrompt = `Input: "${post.raw_text || ''}"
Tags: ${tags.join(', ')}
Event date: ${eventDate}

Write:
1. A short, warm title (max 8 words)
2. A 2-4 sentence story in the SAME LANGUAGE as the input. Make it feel like a cherished family memory — personal, warm, present tense.

Respond in JSON: {"title": "...", "story": "..."}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [
          {
            role: 'system',
            content: 'You are a family chronicle writer. Given a short note from a family member, write a warm, personal story entry for the family\'s digital chronicle.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    await app.db
      .update(schema.posts)
      .set({
        ai_title: parsed.title,
        ai_story: parsed.story,
        ai_status: 'done',
      })
      .where(eq(schema.posts.id, post.id));

    app.logger.info({ postId: post.id }, 'AI story generated successfully');
  } catch (error) {
    app.logger.error({ err: error, postId: post.id }, 'Failed to generate AI story');
    await app.db
      .update(schema.posts)
      .set({ ai_status: 'error' })
      .where(eq(schema.posts.id, post.id));
  }
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
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              posts: {
                type: 'array',
                items: {
                  type: 'object',
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
                    author: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, image: { type: ['string', 'null'] } } },
                    media_count: { type: 'integer' },
                  },
                },
              },
              total: { type: 'integer' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
      const offset = parseInt(request.query.offset || '0', 10);

      app.logger.info({ userId: session.user.id, limit, offset }, 'Fetching posts');

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
        .where(eq(schema.posts.family_id, familyMember[0].family_id))
        .orderBy(desc(schema.posts.created_at))
        .limit(limit)
        .offset(offset);

      const totalResult = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.family_id, familyMember[0].family_id));

      const postsWithDetails = await Promise.all(
        postsData.map(async (p) => {
          const author = await app.db
            .select()
            .from(authSchema.user)
            .where(eq(authSchema.user.id, p.author_id))
            .limit(1);

          const mediaCount = await app.db
            .select()
            .from(schema.media)
            .where(eq(schema.media.post_id, p.id));

          return {
            ...p,
            author: {
              id: author[0].id,
              name: author[0].name,
              image: author[0].image,
            },
            media_count: mediaCount.length,
          };
        })
      );

      app.logger.info({ count: postsWithDetails.length, total: totalResult.length }, 'Posts retrieved');

      return {
        posts: postsWithDetails,
        total: totalResult.length,
      };
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
          ai_status: 'processing',
        })
        .returning();

      const [createdPost] = post;

      app.logger.info({ postId: createdPost.id }, 'Post created, starting AI generation');

      generateAIStory(app, createdPost).catch((error) => {
        app.logger.error({ err: error, postId: createdPost.id }, 'Background AI generation failed');
      });

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
              author: { type: 'object' },
              media: { type: 'array', items: { type: 'object' } },
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

      const media = await app.db
        .select()
        .from(schema.media)
        .where(eq(schema.media.post_id, post[0].id));

      return {
        ...post[0],
        author: {
          id: author[0].id,
          name: author[0].name,
          image: author[0].image,
        },
        media,
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
}
