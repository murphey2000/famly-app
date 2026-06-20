import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function registerFamiliesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.post(
    '/api/families',
    {
      schema: {
        description: 'Create a new family',
        tags: ['families'],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
          },
        },
        response: {
          201: {
            description: 'Family created successfully',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              invite_code: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { name: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id, familyName: request.body.name }, 'Creating family');

      const inviteCode = generateInviteCode();
      const family = await app.db
        .insert(schema.families)
        .values({
          name: request.body.name,
          invite_code: inviteCode,
          created_by: session.user.id,
        })
        .returning();

      const [createdFamily] = family;

      await app.db.insert(schema.family_members).values({
        family_id: createdFamily.id,
        user_id: session.user.id,
        role: 'admin',
      });

      app.logger.info({ familyId: createdFamily.id, inviteCode }, 'Family created successfully');

      reply.status(201);
      return createdFamily;
    }
  );

  app.fastify.get(
    '/api/families',
    {
      schema: {
        description: 'Get current user family with members',
        tags: ['families'],
        response: {
          200: {
            description: 'Family with members',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              invite_code: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              members: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    user_id: { type: 'string' },
                    role: { type: 'string' },
                    joined_at: { type: 'string', format: 'date-time' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        image: { type: ['string', 'null'] },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Fetching user family');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        app.logger.warn({ userId: session.user.id }, 'User has no family');
        return reply.status(404).send({ error: 'No family found' });
      }

      const family = await app.db
        .select()
        .from(schema.families)
        .where(eq(schema.families.id, familyMember[0].family_id))
        .limit(1);

      const members = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.family_id, family[0].id));

      const memberDetails = await Promise.all(
        members.map(async (m) => {
          const usr = await app.db
            .select()
            .from(authSchema.user)
            .where(eq(authSchema.user.id, m.user_id))
            .limit(1);
          return {
            id: m.id,
            user_id: m.user_id,
            role: m.role,
            joined_at: m.joined_at,
            user: {
              id: usr[0].id,
              name: usr[0].name,
              email: usr[0].email,
              image: usr[0].image,
            },
          };
        })
      );

      const familyDetail = {
        id: family[0].id,
        name: family[0].name,
        invite_code: family[0].invite_code,
        created_at: family[0].created_at,
        members: memberDetails,
      };

      app.logger.info({ familyId: familyDetail.id, memberCount: members.length }, 'Family retrieved');

      return familyDetail;
    }
  );

  app.fastify.post(
    '/api/families/join',
    {
      schema: {
        description: 'Join a family via invite code',
        tags: ['families'],
        body: {
          type: 'object',
          required: ['invite_code'],
          properties: {
            invite_code: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Successfully joined family',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              invite_code: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { invite_code: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id, inviteCode: request.body.invite_code }, 'Joining family');

      const family = await app.db.query.families.findFirst({
        where: eq(schema.families.invite_code, request.body.invite_code),
      });

      if (!family) {
        app.logger.warn({ inviteCode: request.body.invite_code }, 'Invalid invite code');
        return reply.status(404).send({ error: 'Family not found' });
      }

      await app.db.insert(schema.family_members).values({
        family_id: family.id,
        user_id: session.user.id,
        role: 'member',
      });

      app.logger.info({ familyId: family.id, userId: session.user.id }, 'User joined family');

      return family;
    }
  );
}
