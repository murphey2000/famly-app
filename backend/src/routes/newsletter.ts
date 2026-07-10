import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import { generateNewsletterPdf } from '../newsletter/generatePdf.js';
import { sendNewsletterEmails } from '../newsletter/sendNewsletter.js';

type NewsletterContent = {
  headline: string;
  sections?: Array<{
    icon?: string;
    title: string;
    items: string[];
  }>;
  member_sections?: Array<{
    user_id?: string;
    name: string;
    avatar_url?: string | null;
    text: string;
  }>;
  featured_photos?: Array<{
    url: string;
    post_title: string;
    author_name: string;
  }>;
  stats: {
    posts: number;
    photos: number;
    members_active: number;
  };
  closing: string;
};

export function registerNewsletterRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/newsletter/latest - Get most recent newsletter for user's family
  app.fastify.get(
    '/api/newsletter/latest',
    {
      schema: {
        description: 'Get the most recent newsletter for the user\'s family',
        tags: ['newsletter'],
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Fetching latest newsletter');

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

      // Get most recent newsletter (ordered by year desc, month desc)
      const newsletters = await app.db
        .select()
        .from(schema.newsletters)
        .where(eq(schema.newsletters.family_id, familyMember[0].family_id))
        .orderBy(desc(schema.newsletters.year), desc(schema.newsletters.month))
        .limit(1);

      if (!newsletters.length) {
        app.logger.warn({ familyId: familyMember[0].family_id }, 'No newsletters found for family');
        return reply.status(404).send({ error: 'No newsletters found' });
      }

      const row = newsletters[0];

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

      app.logger.info({ newsletterId: row.id, familyName }, 'Latest newsletter retrieved successfully');
      return result;
    }
  );

  // GET /api/newsletter/archive - Get all newsletters for user's family
  app.fastify.get(
    '/api/newsletter/archive',
    {
      schema: {
        description: 'Get all newsletters for the user\'s family',
        tags: ['newsletter'],
        response: {
          200: {
            type: 'object',
            properties: {
              newsletters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    month: { type: 'integer' },
                    year: { type: 'integer' },
                    headline: { type: 'string' },
                    generated_at: { type: 'string', format: 'date-time' },
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

      app.logger.info({ userId: session.user.id }, 'Fetching newsletter archive');

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

      // Get all newsletters ordered by year desc, month desc
      const newsletters = await app.db
        .select()
        .from(schema.newsletters)
        .where(eq(schema.newsletters.family_id, familyMember[0].family_id))
        .orderBy(desc(schema.newsletters.year), desc(schema.newsletters.month));

      const result = newsletters.map(row => ({
        id: row.id,
        month: row.month,
        year: row.year,
        headline: row.content?.headline ?? '',
        generated_at: row.generated_at,
      }));

      app.logger.info({ familyId: familyMember[0].family_id, count: result.length }, 'Newsletter archive retrieved successfully');
      return { newsletters: result };
    }
  );

  // POST /api/newsletter/generate - Generate newsletter for specified month/year
  app.fastify.post(
    '/api/newsletter/generate',
    {
      schema: {
        description: 'Generate a newsletter for the specified month and year',
        tags: ['newsletter'],
        body: {
          type: 'object',
          required: ['month', 'year'],
          properties: {
            month: { type: 'integer', minimum: 1, maximum: 12 },
            year: { type: 'integer', minimum: 2000, maximum: 2099 },
          },
        },
        response: {
          201: {
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
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { month: number; year: number } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { month, year } = request.body;

      app.logger.info({ userId: session.user.id, month, year }, 'Generating newsletter');

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

      const familyId = familyMember[0].family_id;

      // Check if newsletter already exists for this family + month + year
      const existing = await app.db
        .select()
        .from(schema.newsletters)
        .where(
          and(
            eq(schema.newsletters.family_id, familyId),
            eq(schema.newsletters.month, month),
            eq(schema.newsletters.year, year)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        app.logger.info({ familyId, month, year }, 'Newsletter already exists for this month, returning existing');
        const row = existing[0];
        const families = await app.db
          .select()
          .from(schema.families)
          .where(eq(schema.families.id, familyId))
          .limit(1);

        const familyName = families.length > 0 ? families[0].name : '';

        return reply.status(201).send({
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
        });
      }

      // Fetch published posts from specified month
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);

      const publishedPosts = await app.db
        .select()
        .from(schema.posts)
        .where(
          and(
            eq(schema.posts.family_id, familyId),
            eq(schema.posts.ai_status, 'published'),
          )
        );

      // Filter posts within month range
      const postsThisMonth = publishedPosts.filter(post => {
        const createdDate = new Date(post.created_at);
        return createdDate >= monthStart && createdDate < new Date(monthEnd.getTime() + 24 * 60 * 60 * 1000);
      });

      // Get featured photos from posts
      const media = await app.db
        .select()
        .from(schema.media)
        .where(eq(schema.media.family_id, familyId));

      const featuredPhotos = media
        .filter(m => m.type === 'photo' && postsThisMonth.some(p => p.id === m.post_id))
        .slice(0, 5)
        .map(m => ({
          url: m.url,
          post_title: postsThisMonth.find(p => p.id === m.post_id)?.ai_title ?? 'Unknown',
          author_name: 'Family Member',
        }));

      // Get active family members
      const familyMembers = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.family_id, familyId));

      const stats = {
        posts: postsThisMonth.length,
        photos: media.filter(m => m.type === 'photo').length,
        members_active: familyMembers.length,
      };

      // Build prompt for AI in German
      const postsText = postsThisMonth
        .map(p => `- ${p.ai_title || p.raw_text?.substring(0, 100)}: ${p.ai_story || p.raw_text || ''}`)
        .join('\n');

      const prompt = `Du bist ein freundlicher Newsletter-Schreiber für eine Familie. Erstelle einen warmen, persönlichen Familien-Newsletter für ${month}/${year}.

Hier sind die Beiträge dieses Monats:
${postsText || 'Keine neuen Beiträge diesen Monat'}

Statistiken: ${stats.posts} Beiträge, ${stats.photos} Fotos, ${stats.members_active} aktive Familienmitglieder

Erstelle einen Newsletter als JSON mit folgender Struktur:
{
  "headline": "Ansprechende Überschrift für den Newsletter",
  "sections": [
    {
      "icon": "emoji oder icon name",
      "title": "Sektions-Titel",
      "items": ["Punkt 1", "Punkt 2"]
    }
  ],
  "member_sections": [
    {
      "name": "Name des Familienmitglieds",
      "text": "Kurzer persönlicher Highlight über dieses Mitglied"
    }
  ],
  "featured_photos": [
    {
      "url": "Verwende eine der vorhandenen Foto-URLs",
      "post_title": "Titel des Beitrags",
      "author_name": "Name des Autors"
    }
  ],
  "stats": {
    "posts": ${stats.posts},
    "photos": ${stats.photos},
    "members_active": ${stats.members_active}
  },
  "closing": "Eine herzliche, persönliche Abschlussnachricht"
}`;

      try {
        app.logger.info({ familyId, month, year }, 'Generating newsletter content');

        // Generate content using default template (AI is optional)
        const output: NewsletterContent = {
          headline: `Newsletter ${month}/${year}`,
          sections: [
            {
              icon: '📸',
              title: 'Highlights',
              items: [`${postsThisMonth.length} Beiträge geteilt`],
            },
          ],
          member_sections: [],
          featured_photos: featuredPhotos,
          stats,
          closing: 'Vielen Dank, dass ihr Teil dieser Familie seid!',
        };

        // Insert newsletter into database
        const [newsletter] = await app.db
          .insert(schema.newsletters)
          .values({
            family_id: familyId,
            month,
            year,
            content: output as any,
          })
          .returning();

        app.logger.info({ newsletterId: newsletter.id, familyId, month, year }, 'Newsletter generated and saved');

        // Get family name for response
        const families = await app.db
          .select()
          .from(schema.families)
          .where(eq(schema.families.id, familyId))
          .limit(1);

        const familyName = families.length > 0 ? families[0].name : '';

        // Generate PDF in the background (non-blocking)
        setImmediate(async () => {
          try {
            await generateNewsletterPdf(familyName, month, year, output);
            app.logger.info({ newsletterId: newsletter.id, familyId }, 'Newsletter PDF generated successfully');
          } catch (err) {
            app.logger.warn({ err, newsletterId: newsletter.id }, 'PDF generation failed, continuing without PDF');
          }
        });

        // Send emails to family members in the background (non-blocking)
        setImmediate(async () => {
          try {
            const familyMembers = await app.db
              .select()
              .from(schema.family_members)
              .where(eq(schema.family_members.family_id, familyId));

            if (familyMembers.length === 0) {
              app.logger.warn({ familyId }, 'No family members found for newsletter email');
              return;
            }

            // Get user details for members
            const memberUserIds = familyMembers.map((m) => m.user_id);
            const memberUsers = await app.db
              .select()
              .from(authSchema.user)
              .where(inArray(authSchema.user.id, memberUserIds));

            if (memberUsers.length === 0) {
              app.logger.warn({ familyId }, 'No users found for family members');
              return;
            }

            const result = await sendNewsletterEmails(
              familyName,
              month,
              year,
              output,
              memberUsers,
              process.env.RESEND_API_KEY,
              process.env.NEWSLETTER_FROM_EMAIL || 'newsletter@famly.app',
              app.logger
            );

            app.logger.info({ familyId, sent: result.sent, failed: result.failed }, 'Newsletter emails sent');
          } catch (err) {
            app.logger.error({ err, familyId }, 'Error sending newsletter emails');
          }
        });

        return reply.status(201).send({
          id: newsletter.id,
          month: newsletter.month,
          year: newsletter.year,
          family_name: familyName,
          headline: output.headline,
          sections: output.sections,
          member_sections: output.member_sections,
          featured_photos: output.featured_photos,
          stats: output.stats,
          closing: output.closing,
          created_at: newsletter.generated_at,
        });
      } catch (error) {
        app.logger.error({ err: error, familyId, month, year }, 'Failed to generate newsletter');
        return reply.status(500).send({ error: 'Failed to generate newsletter' });
      }
    }
  );

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
