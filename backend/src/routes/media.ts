import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

export function registerMediaRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.post(
    '/api/posts/:id/media',
    {
      schema: {
        description: 'Add media to a post',
        tags: ['media'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['type', 'url'],
          properties: {
            type: { type: 'string', enum: ['photo', 'video', 'audio'] },
            url: { type: 'string' },
            thumbnail_url: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              post_id: { type: 'string', format: 'uuid' },
              type: { type: 'string' },
              url: { type: 'string' },
              thumbnail_url: { type: ['string', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { type: string; url: string; thumbnail_url?: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ postId: request.params.id, userId: session.user.id }, 'Adding media to post');

      const post = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, request.params.id))
        .limit(1);

      if (!post.length) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      const media = await app.db
        .insert(schema.media)
        .values({
          post_id: post[0].id,
          family_id: post[0].family_id,
          uploader_id: session.user.id,
          type: request.body.type,
          url: request.body.url,
          thumbnail_url: request.body.thumbnail_url || null,
        })
        .returning();

      const [createdMedia] = media;

      app.logger.info({ mediaId: createdMedia.id, postId: post[0].id }, 'Media added successfully');

      reply.status(201);
      return createdMedia;
    }
  );

  app.fastify.post(
    '/api/upload-url',
    {
      schema: {
        description: 'Get signed upload URL for media',
        tags: ['media'],
        body: {
          type: 'object',
          required: ['filename', 'content_type'],
          properties: {
            filename: { type: 'string' },
            content_type: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              upload_url: { type: 'string' },
              public_url: { type: 'string' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { filename: string; content_type: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id, filename: request.body.filename }, 'Getting upload URL');

      const uniqueId = Math.random().toString(36).substring(2, 15);
      const key = `media/${session.user.id}/${uniqueId}/${request.body.filename}`;

      const uploadUrl = `${process.env.STORAGE_API_BASE_URL}/upload?key=${encodeURIComponent(key)}&content_type=${encodeURIComponent(request.body.content_type)}`;
      const publicUrl = `${process.env.STORAGE_API_BASE_URL}/public/${key}`;

      app.logger.info({ key }, 'Upload URL generated');

      return {
        upload_url: uploadUrl,
        public_url: publicUrl,
      };
    }
  );

  app.fastify.get(
    '/api/memories/today',
    {
      schema: {
        description: 'Get posts from same day in previous years',
        tags: ['posts'],
        response: {
          200: {
            type: 'object',
            properties: {
              memories: {
                type: 'array',
                items: { type: 'object' },
              },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Fetching memories from today');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      const memories = await app.db
        .select()
        .from(schema.posts)
        .where(
          and(
            eq(schema.posts.family_id, familyMember[0].family_id),
            sql`EXTRACT(MONTH FROM ${schema.posts.event_date}) = ${month}`,
            sql`EXTRACT(DAY FROM ${schema.posts.event_date}) = ${day}`,
            sql`EXTRACT(YEAR FROM ${schema.posts.event_date}) < ${today.getFullYear()}`
          )
        )
        .orderBy(desc(schema.posts.event_date));

      app.logger.info({ count: memories.length }, 'Memories retrieved');

      return { memories };
    }
  );

  app.fastify.get(
    '/api/timeline',
    {
      schema: {
        description: 'Get posts grouped by year/month for timeline',
        tags: ['posts'],
        querystring: {
          type: 'object',
          properties: {
            year: { type: 'integer' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              groups: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    year: { type: 'integer' },
                    month: { type: 'integer' },
                    month_name: { type: 'string' },
                    posts: { type: 'array', items: { type: 'object' } },
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
    async (request: FastifyRequest<{ Querystring: { year?: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id, year: request.query.year }, 'Fetching timeline');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        return reply.status(404).send({ error: 'No family found' });
      }

      let whereCondition = eq(schema.posts.family_id, familyMember[0].family_id);

      if (request.query.year) {
        const year = parseInt(request.query.year, 10);
        whereCondition = and(
          whereCondition,
          sql`EXTRACT(YEAR FROM ${schema.posts.event_date}) = ${year}`
        ) as any;
      }

      const posts = await app.db
        .select()
        .from(schema.posts)
        .where(whereCondition)
        .orderBy(desc(schema.posts.event_date));

      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];

      const groupMap = new Map<string, any>();

      for (const post of posts) {
        if (!post.event_date) continue;

        const date = new Date(post.event_date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const key = `${year}-${month}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            year,
            month,
            month_name: monthNames[month - 1],
            posts: [],
          });
        }

        groupMap.get(key)!.posts.push(post);
      }

      const groups = Array.from(groupMap.values()).sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.month - a.month;
      });

      app.logger.info({ groupCount: groups.length }, 'Timeline retrieved');

      return { groups };
    }
  );
}
