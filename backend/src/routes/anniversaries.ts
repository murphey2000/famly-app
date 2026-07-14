import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface Anniversary {
  id: string;
  family_id: string;
  title: string;
  date: string;
  created_by: string;
  created_at: string;
}

function getDaysUntilAnniversary(dateStr: string): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [year, month, day] = dateStr.split('-').map(Number);
  let nextDate = new Date(Date.UTC(today.getUTCFullYear(), month - 1, day));
  nextDate.setUTCHours(0, 0, 0, 0);

  if (nextDate < today) {
    nextDate = new Date(Date.UTC(today.getUTCFullYear() + 1, month - 1, day));
    nextDate.setUTCHours(0, 0, 0, 0);
  }

  const diffTime = nextDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function register(app: App, fastify: any) {
  const requireAuth = app.requireAuth();

  // GET /api/anniversaries - Get all anniversaries for user's family, ordered by month+day
  fastify.get(
    '/api/anniversaries',
    {
      schema: {
        description: 'Get all anniversaries for the user\'s family, ordered by month and day',
        tags: ['anniversaries'],
        response: {
          200: {
            description: 'List of anniversaries',
            type: 'object',
            properties: {
              anniversaries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    family_id: { type: 'string', format: 'uuid' },
                    title: { type: 'string' },
                    date: { type: 'string' },
                    created_by: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
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

      app.logger.info({ userId: session.user.id }, 'Fetching anniversaries');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        app.logger.warn({ userId: session.user.id }, 'User has no family');
        return reply.status(404).send({ error: 'No family found' });
      }

      const familyId = familyMember[0].family_id;

      const anniversaries = await app.db
        .select()
        .from(schema.family_anniversaries)
        .where(eq(schema.family_anniversaries.family_id, familyId));

      const sorted = anniversaries.sort((a, b) => {
        const [, aMonth, aDay] = a.date.split('-').map(Number);
        const [, bMonth, bDay] = b.date.split('-').map(Number);
        if (aMonth !== bMonth) return aMonth - bMonth;
        return aDay - bDay;
      });

      app.logger.info({ familyId, count: sorted.length }, 'Anniversaries retrieved');

      return { anniversaries: sorted };
    }
  );

  // POST /api/anniversaries - Create a new anniversary
  fastify.post(
    '/api/anniversaries',
    {
      schema: {
        description: 'Create a new anniversary',
        tags: ['anniversaries'],
        body: {
          type: 'object',
          required: ['title', 'date'],
          properties: {
            title: { type: 'string' },
            date: { type: 'string', description: 'ISO date format YYYY-MM-DD' },
          },
        },
        response: {
          201: {
            description: 'Anniversary created successfully',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              family_id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              date: { type: 'string' },
              created_by: { type: 'string' },
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
    async (request: FastifyRequest<{ Body: { title: string; date: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id, title: request.body.title, date: request.body.date }, 'Creating anniversary');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        app.logger.warn({ userId: session.user.id }, 'User has no family');
        return reply.status(404).send({ error: 'No family found' });
      }

      const familyId = familyMember[0].family_id;

      const created = await app.db
        .insert(schema.family_anniversaries)
        .values({
          family_id: familyId,
          title: request.body.title,
          date: request.body.date,
          created_by: session.user.id,
        })
        .returning();

      const [anniversary] = created;

      app.logger.info({ anniversaryId: anniversary.id, familyId }, 'Anniversary created successfully');

      reply.status(201);
      return anniversary;
    }
  );

  // DELETE /api/anniversaries/:id - Delete an anniversary
  fastify.delete(
    '/api/anniversaries/:id',
    {
      schema: {
        description: 'Delete an anniversary',
        tags: ['anniversaries'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Anniversary deleted successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id, anniversaryId: request.params.id }, 'Deleting anniversary');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        app.logger.warn({ userId: session.user.id }, 'User has no family');
        return reply.status(404).send({ error: 'No family found' });
      }

      const familyId = familyMember[0].family_id;

      const anniversary = await app.db
        .select()
        .from(schema.family_anniversaries)
        .where(eq(schema.family_anniversaries.id, request.params.id))
        .limit(1);

      if (!anniversary.length) {
        app.logger.warn({ anniversaryId: request.params.id }, 'Anniversary not found');
        return reply.status(404).send({ error: 'Anniversary not found' });
      }

      if (anniversary[0].family_id !== familyId) {
        app.logger.warn({ anniversaryId: request.params.id, familyId, expectedFamilyId: anniversary[0].family_id }, 'Ownership check failed');
        return reply.status(404).send({ error: 'Anniversary not found' });
      }

      await app.db.delete(schema.family_anniversaries).where(eq(schema.family_anniversaries.id, request.params.id));

      app.logger.info({ anniversaryId: request.params.id, familyId }, 'Anniversary deleted successfully');

      return { success: true };
    }
  );

  // GET /api/anniversaries/upcoming - Get upcoming anniversaries (within 30 days)
  fastify.get(
    '/api/anniversaries/upcoming',
    {
      schema: {
        description: 'Get upcoming anniversaries within the next 30 days',
        tags: ['anniversaries'],
        response: {
          200: {
            description: 'List of upcoming anniversaries',
            type: 'object',
            properties: {
              anniversaries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    family_id: { type: 'string', format: 'uuid' },
                    title: { type: 'string' },
                    date: { type: 'string' },
                    created_by: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                    days_until: { type: 'integer' },
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

      app.logger.info({ userId: session.user.id }, 'Fetching upcoming anniversaries');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        app.logger.warn({ userId: session.user.id }, 'User has no family');
        return reply.status(404).send({ error: 'No family found' });
      }

      const familyId = familyMember[0].family_id;

      const anniversaries = await app.db
        .select()
        .from(schema.family_anniversaries)
        .where(eq(schema.family_anniversaries.family_id, familyId));

      const withDaysUntil = anniversaries.map((ann) => ({
        ...ann,
        days_until: getDaysUntilAnniversary(ann.date),
      }));

      const upcoming = withDaysUntil
        .filter((ann) => ann.days_until <= 30)
        .sort((a, b) => a.days_until - b.days_until);

      app.logger.info({ familyId, count: upcoming.length }, 'Upcoming anniversaries retrieved');

      return { anniversaries: upcoming };
    }
  );
}
