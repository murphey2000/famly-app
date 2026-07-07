import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerNewsletterRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get(
    '/api/newsletter/:id',
    {
      schema: {
        description: 'Get a newsletter by ID',
        tags: ['newsletter'],
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
              month: { type: 'integer' },
              year: { type: 'integer' },
              family_name: { type: 'string' },
              headline: { type: 'string' },
              sections: { type: 'array' },
              member_sections: { type: 'array' },
              featured_photos: { type: 'array' },
              stats: { type: 'object' },
              closing: { type: 'string' },
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ newsletterId: request.params.id, userId: session.user.id }, 'Fetching newsletter');

      // Look up the user's family
      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        app.logger.warn({ userId: session.user.id }, 'No family found for user');
        return reply.status(404).send({ error: 'No family found' });
      }

      // Query newsletters table for row matching both id and family_id
      const newsletter = await app.db
        .select()
        .from(schema.newsletters)
        .where(
          and(
            eq(schema.newsletters.id, request.params.id),
            eq(schema.newsletters.family_id, familyMember[0].family_id)
          )
        )
        .limit(1);

      if (!newsletter.length) {
        app.logger.warn({ newsletterId: request.params.id, familyId: familyMember[0].family_id }, 'Newsletter not found');
        return reply.status(404).send({ error: 'Newsletter not found' });
      }

      const row = newsletter[0];

      // Look up family name
      const families = await app.db
        .select()
        .from(schema.families)
        .where(eq(schema.families.id, familyMember[0].family_id))
        .limit(1);

      const familyName = families.length > 0 ? families[0].name : '';

      const result = {
        id: row.id,
        month: row.month,
        year: row.year,
        family_name: familyName,
        headline: row.content?.headline ?? '',
        sections: row.content?.sections ?? [],
        member_sections: row.content?.member_sections ?? [],
        featured_photos: row.content?.featured_photos ?? [],
        stats: row.content?.stats ?? { posts: 0, photos: 0, members_active: 0 },
        closing: row.content?.closing ?? '',
        created_at: row.generated_at,
      };

      app.logger.info({ newsletterId: row.id, familyName }, 'Newsletter retrieved successfully');
      return result;
    }
  );
}
