import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
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
    '/api/newsletter/generate',
    {
      schema: {
        description: 'Generate monthly newsletter',
        tags: ['newsletter'],
        body: {
          type: 'object',
          required: ['month', 'year'],
          properties: {
            month: { type: 'integer' },
            year: { type: 'integer' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              family_id: { type: 'string', format: 'uuid' },
              month: { type: 'integer' },
              year: { type: 'integer' },
              content: { type: 'object' },
              generated_at: { type: 'string', format: 'date-time' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { month: number; year: number } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info(
        { userId: session.user.id, month: request.body.month, year: request.body.year },
        'Generating newsletter'
      );

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const familyId = familyMember[0].family_id;

      const posts = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.family_id, familyId));

      const filteredPosts = posts.filter((p) => {
        if (!p.event_date) return false;
        const date = new Date(p.event_date);
        return date.getMonth() + 1 === request.body.month && date.getFullYear() === request.body.year;
      });

      const mediaCount = await app.db.select().from(schema.media).where(eq(schema.media.family_id, familyId));

      const activeMembersSet = new Set<string>();
      for (const post of filteredPosts) {
        activeMembersSet.add(post.author_id);
      }

      const summaryText = filteredPosts.map((p) => p.ai_story || p.raw_text).join('\n');

      let parsed: any = null;

      if (process.env.OPENROUTER_API_KEY) {
        try {
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
                  role: 'user',
                  content: `Generate a family newsletter for ${request.body.month}/${request.body.year}. Posts summary: ${summaryText}.

Respond in JSON with this exact structure:
{
  "headline": "Familie [Name] – [Month] [Year]",
  "sections": [
    { "icon": "🎂", "title": "Geburtstage", "items": ["..."] },
    { "icon": "✈️", "title": "Reisen", "items": ["..."] },
    { "icon": "📚", "title": "Schule & Arbeit", "items": ["..."] },
    { "icon": "📸", "title": "Besondere Momente", "items": ["..."] }
  ],
  "stats": { "posts": ${filteredPosts.length}, "photos": ${mediaCount.length}, "members_active": ${activeMembersSet.size} },
  "closing": "Ein wunderschöner Monat voller Erinnerungen."
}`,
                },
              ],
            }),
          });

          if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
          }

          const data = await response.json() as { choices: Array<{ message: { content: string } }> };
          const content = data.choices[0].message.content;
          parsed = JSON.parse(content);
        } catch (error) {
          app.logger.error({ err: error }, 'Failed to call OpenRouter API, using fallback newsletter');
        }
      } else {
        app.logger.warn('OPENROUTER_API_KEY not set, using fallback newsletter');
      }

      if (!parsed) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        parsed = {
          headline: `Family Newsletter – ${monthNames[request.body.month - 1]} ${request.body.year}`,
          sections: [
            { icon: '🎂', title: 'Special Moments', items: filteredPosts.map((p) => p.ai_title || p.raw_text || 'Untitled').slice(0, 5) },
          ],
          stats: { posts: filteredPosts.length, photos: mediaCount.length, members_active: activeMembersSet.size },
          closing: 'A wonderful month full of memories.',
        };
      }

      const existingNewsletter = await app.db
        .select()
        .from(schema.newsletters)
        .where(
          eq(schema.newsletters.family_id, familyId)
        );

      const existing = existingNewsletter.find(
        (n) => n.month === request.body.month && n.year === request.body.year
      );

      if (existing) {
        const updated = await app.db
          .update(schema.newsletters)
          .set({ content: parsed as any })
          .where(eq(schema.newsletters.id, existing.id))
          .returning();

        app.logger.info({ newsletterId: updated[0].id }, 'Newsletter updated');
        return updated[0];
      } else {
        const created = await app.db
          .insert(schema.newsletters)
          .values({
            family_id: familyId,
            month: request.body.month,
            year: request.body.year,
            content: parsed as any,
          })
          .returning();

        app.logger.info({ newsletterId: created[0].id }, 'Newsletter generated');
        return created[0];
      }
    }
  );

  app.fastify.get(
    '/api/newsletter/latest',
    {
      schema: {
        description: 'Get latest newsletter for user family',
        tags: ['newsletter'],
        response: {
          200: {
            type: 'object',
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Fetching latest newsletter');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const newsletters = await app.db
        .select()
        .from(schema.newsletters)
        .where(eq(schema.newsletters.family_id, familyMember[0].family_id))
        .orderBy((t) => [t.year, t.month]);

      if (!newsletters.length) {
        return {};
      }

      app.logger.info({ newsletterId: newsletters[newsletters.length - 1].id }, 'Latest newsletter retrieved');

      return newsletters[newsletters.length - 1];
    }
  );
}
