import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';
import * as schema from '../db/schema/schema.js';

export function registerProfileRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get(
    '/api/profile',
    {
      schema: {
        description: 'Get current user profile',
        tags: ['profile'],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              image: { type: ['string', 'null'] },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Fetching user profile');

      const user = await app.db
        .select()
        .from(authSchema.user)
        .where(eq(authSchema.user.id, session.user.id))
        .limit(1);

      if (!user.length) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return {
        id: user[0].id,
        name: user[0].name,
        email: user[0].email,
        image: user[0].image,
      };
    }
  );

  app.fastify.patch(
    '/api/profile',
    {
      schema: {
        description: 'Update user profile',
        tags: ['profile'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            avatar_url: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              image: { type: ['string', 'null'] },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { name?: string; avatar_url?: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Updating user profile');

      const updates: any = {};
      if (request.body.name) updates.name = request.body.name;
      if (request.body.avatar_url) updates.image = request.body.avatar_url;

      if (Object.keys(updates).length === 0) {
        return {
          id: session.user.id,
          name: session.user.name || '',
          email: session.user.email || '',
          image: session.user.image || null,
        };
      }

      const updated = await app.db
        .update(authSchema.user)
        .set(updates)
        .where(eq(authSchema.user.id, session.user.id))
        .returning();

      const [user] = updated;

      app.logger.info({ userId: session.user.id }, 'User profile updated');

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
    }
  );

  app.fastify.post(
    '/api/profile/push-token',
    {
      schema: {
        description: 'Save Expo push token for current user',
        tags: ['profile'],
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { token: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Saving push token');

      await app.db
        .update(authSchema.user)
        .set({ push_token: request.body.token })
        .where(eq(authSchema.user.id, session.user.id));

      return { success: true };
    }
  );

  app.fastify.patch(
    '/api/profile/birthday',
    {
      schema: {
        description: 'Update current user birthday',
        tags: ['profile'],
        body: {
          type: 'object',
          required: ['birthday'],
          properties: {
            birthday: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { birthday: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id, birthday: request.body.birthday }, 'Updating user birthday');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        return reply.status(404).send({ error: 'No family found' });
      }

      await app.db
        .update(schema.family_members)
        .set({ birthday: request.body.birthday })
        .where(eq(schema.family_members.id, familyMember[0].id));

      app.logger.info({ userId: session.user.id }, 'Birthday updated successfully');

      return { success: true };
    }
  );

  app.fastify.put(
    '/api/profile/birthday',
    {
      schema: {
        description: 'Set user birthday',
        tags: ['profile'],
        body: {
          type: 'object',
          required: ['birthday'],
          properties: {
            birthday: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { birthday?: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (!request.body.birthday || request.body.birthday.trim() === '') {
        app.logger.warn({ userId: session.user.id }, 'Birthday is required but missing or empty');
        return reply.status(400).send({ error: 'birthday is required' });
      }

      app.logger.info({ userId: session.user.id, birthday: request.body.birthday }, 'Setting user birthday');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        app.logger.warn({ userId: session.user.id }, 'Family member record not found');
        return reply.status(404).send({ error: 'Family member record not found' });
      }

      await app.db
        .update(schema.family_members)
        .set({ birthday: request.body.birthday })
        .where(eq(schema.family_members.id, familyMember[0].id));

      app.logger.info({ userId: session.user.id, familyMemberId: familyMember[0].id }, 'Birthday set successfully');

      return { success: true };
    }
  );
}
