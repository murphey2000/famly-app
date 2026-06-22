import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import sharp from 'sharp';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import { getSignedDownloadUrl } from '../lib/storage-utils.js';

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
            storage_key: { type: 'string' },
            thumbnail_key: { type: 'string' },
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
      request: FastifyRequest<{
        Params: { id: string };
        Body: { type: string; url: string; thumbnail_url?: string; storage_key?: string; thumbnail_key?: string };
      }>,
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
          storage_key: request.body.storage_key || null,
          thumbnail_key: request.body.thumbnail_key || null,
        })
        .returning();

      const [createdMedia] = media;

      app.logger.info({ mediaId: createdMedia.id, postId: post[0].id }, 'Media added successfully');

      reply.status(201);
      return createdMedia;
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

  app.fastify.post(
    '/api/upload-file',
    {
      schema: {
        description: 'Upload a file to S3 storage',
        tags: ['media'],
        response: {
          200: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              url: { type: 'string' },
              public_url: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'File upload endpoint called');

      try {
        // Get user's family
        const familyMember = await app.db
          .select()
          .from(schema.family_members)
          .where(eq(schema.family_members.user_id, session.user.id))
          .limit(1);

        if (!familyMember.length) {
          return reply.status(404).send({ error: 'No family found' });
        }

        const familyId = familyMember[0].family_id;

        // Try to get the file from the request
        let data: any;
        try {
          data = await request.file();
          app.logger.info({ filename: data?.filename, mimetype: data?.mimetype }, 'File retrieved from request');
        } catch (fileError) {
          app.logger.error({ err: fileError }, 'request.file() threw an error');
          return reply.status(400).send({ error: 'No file provided' });
        }

        // Check if file data exists
        if (!data) {
          app.logger.warn('request.file() returned null');
          return reply.status(400).send({ error: 'No file provided' });
        }

        // Prefer the multipart part's own filename; fall back to a `filename`
        // text field (native multipart uploads don't always set the part name).
        const filename: string =
          data.filename || (data.fields?.filename?.value as string | undefined) || `upload_${Date.now()}.jpg`;
        const mimetype = data.mimetype || 'application/octet-stream';

        // Convert file to buffer
        let buffer: Buffer;
        try {
          buffer = await data.toBuffer();
          app.logger.info({ filename, size: buffer.length }, 'File converted to buffer');
        } catch (bufferError) {
          app.logger.error({ err: bufferError }, 'Failed to convert file to buffer');
          return reply.status(400).send({ error: 'Failed to read file' });
        }

        // Apply automatic photo enhancement for images
        let enhancedMimetype = mimetype;
        if (mimetype.startsWith('image/')) {
          try {
            app.logger.info({ filename, originalSize: buffer.length }, 'Starting photo enhancement');
            buffer = await sharp(buffer)
              .normalize()
              .sharpen({ sigma: 0.5 })
              .jpeg({ quality: 85 })
              .toBuffer();
            enhancedMimetype = 'image/jpeg';
            app.logger.info({ filename, enhancedSize: buffer.length }, 'Photo enhancement completed');
          } catch (enhanceError) {
            app.logger.warn({ err: enhanceError, filename }, 'Photo enhancement failed, using original');
          }
        }

        // Generate storage key with sanitized filename
        const uniqueId = crypto.randomUUID();
        const safeFilename = filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '');
        const originalExtension = safeFilename.split('.').pop() || 'bin';
        // Enhancement re-encodes to JPEG, so the stored key must reflect that —
        // otherwise the bytes (JPEG) and the key's extension (e.g. .png/.heic) mismatch.
        const fileExtension = enhancedMimetype === 'image/jpeg' ? 'jpg' : originalExtension;
        const storageKey = `media/${familyId}/${uniqueId}.${fileExtension}`;

        // Upload the file to storage
        app.logger.info({ storageKey, mimetype, bufferSize: buffer.length }, 'Uploading to storage');

        try {
          const uploadedKey = await app.storage.upload(storageKey, buffer);
          app.logger.info({ uploadedKey }, 'File uploaded to storage successfully');

          // No permanent public URL exists — mint a short-lived presigned URL
          // for immediate display. The durable reference is `uploadedKey`, which
          // clients persist as storage_key so the read paths can re-sign later.
          const signedUrl = await getSignedDownloadUrl(uploadedKey);
          app.logger.info({ filename, uploadedKey, signed: !!signedUrl }, 'File upload completed successfully');

          return {
            key: uploadedKey,
            url: signedUrl ?? '',
            public_url: signedUrl ?? '',
          };
        } catch (uploadError) {
          app.logger.error({ err: uploadError, storageKey }, 'Storage upload failed');
          return reply.status(500).send({ error: 'File upload failed' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        app.logger.error({ err: error, message }, 'Unexpected error in file upload');
        return reply.status(500).send({ error: 'File upload failed' });
      }
    }
  );
}
