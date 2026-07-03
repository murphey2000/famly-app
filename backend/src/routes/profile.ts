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

  app.fastify.post(
    '/api/newsletter/generate',
    {
      schema: {
        description: 'Generate monthly newsletter with featured photos and member sections',
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
            additionalProperties: true,
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
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

      const { month, year } = request.body;

      app.logger.info({ userId: session.user.id, month, year }, 'Generating newsletter');

      // Get family of authenticated user
      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const familyId = familyMember[0].family_id;

      // Get family name
      const family = await app.db
        .select()
        .from(schema.families)
        .where(eq(schema.families.id, familyId))
        .limit(1);

      if (!family.length) {
        return reply.status(404).send({ error: 'Family not found' });
      }

      // Get posts for the month
      const postsForMonth = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.family_id, familyId));

      // Filter posts by month/year in memory
      const filteredPosts = postsForMonth.filter(p => {
        const d = new Date(p.created_at);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      });

      app.logger.info({ familyId, month, year, postCount: filteredPosts.length }, 'Fetched posts for month');

      // Feature 1: Featured photos
      let featuredPhotos: Array<{ url: string; post_title: string; author_name: string }> = [];
      if (filteredPosts.length > 0) {
        const media = await app.db
          .select()
          .from(schema.media)
          .where(
            and(
              eq(schema.media.family_id, familyId),
              eq(schema.media.type, 'photo')
            )
          );

        // Filter media by month/year
        const monthMedia = media.filter(m => {
          const d = new Date(m.created_at);
          return d.getFullYear() === year && (d.getMonth() + 1) === month;
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

        if (monthMedia.length > 0) {
          // Join with posts and users
          const postIds = monthMedia.map(m => m.post_id);
          const posts = await app.db
            .select()
            .from(schema.posts)
            .where(inArray(schema.posts.id, postIds));

          const authorIds = posts.map(p => p.author_id);
          const users = authorIds.length > 0
            ? await app.db
                .select()
                .from(authSchema.user)
                .where(inArray(authSchema.user.id, authorIds))
            : [];

          const postMap = new Map(posts.map(p => [p.id, p]));
          const userMap = new Map(users.map(u => [u.id, u]));

          const photoList = monthMedia.map(m => {
            const post = postMap.get(m.post_id);
            const author = userMap.get(post?.author_id);
            return {
              url: m.url,
              post_title: post?.ai_title || post?.raw_text || 'Untitled',
              author_name: author?.name || 'Unknown',
            };
          });

          // If more than 3 photos, use AI to pick top 3
          if (photoList.length > 3) {
            app.logger.info({ familyId, photoCount: photoList.length }, 'Selecting top 3 photos with AI');
            try {
              if (!process.env.OPENROUTER_API_KEY) {
                app.logger.warn({}, 'OPENROUTER_API_KEY not configured, using first 3 photos');
                featuredPhotos = photoList.slice(0, 3);
              } else {
                const photoListStr = photoList.map((p, i) => `${i}: "${p.post_title}" by ${p.author_name}`).join('\n');
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
                        content: `You have a list of ${photoList.length} photos. Return the indices of the 3 most visually interesting ones. Reply with only a JSON object: {"indices": [i, j, k]}.\n\nPhotos:\n${photoListStr}`,
                      },
                    ],
                  }),
                });

                if (response.ok) {
                  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
                  const content = data.choices[0].message.content;
                  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
                  const parsed = JSON.parse(cleaned) as { indices: number[] };
                  const selectedIndices = parsed.indices.filter(i => i >= 0 && i < photoList.length).slice(0, 3);
                  featuredPhotos = selectedIndices.map(i => photoList[i]);
                  app.logger.info({ indices: selectedIndices }, 'Selected photos with AI');
                } else {
                  app.logger.warn({ status: response.status }, 'AI photo selection failed, using first 3');
                  featuredPhotos = photoList.slice(0, 3);
                }
              }
            } catch (error) {
              app.logger.warn({ err: error }, 'Error selecting photos with AI, using first 3');
              featuredPhotos = photoList.slice(0, 3);
            }
          } else {
            featuredPhotos = photoList;
          }
        }
      }

      // Feature 2: Member sections
      const memberSections: Array<{ user_id: string; name: string; avatar_url: string | null; text: string }> = [];
      const postsByAuthor = new Map<string, typeof filteredPosts>();
      for (const post of filteredPosts) {
        if (!postsByAuthor.has(post.author_id)) {
          postsByAuthor.set(post.author_id, []);
        }
        postsByAuthor.get(post.author_id)!.push(post);
      }

      const authorIds = Array.from(postsByAuthor.keys());
      const authors = authorIds.length > 0
        ? await app.db
            .select()
            .from(authSchema.user)
            .where(inArray(authSchema.user.id, authorIds))
        : [];

      const authorMap = new Map(authors.map(a => [a.id, a]));

      // Generate member sections in parallel
      const memberPromises = authorIds.map(async (authorId) => {
        const author = authorMap.get(authorId);
        if (!author) return null;

        const authorPosts = postsByAuthor.get(authorId) || [];
        const postsSummary = authorPosts
          .map(p => p.ai_story || p.raw_text || '')
          .filter(Boolean)
          .join(' ');

        if (!postsSummary.trim()) {
          return {
            user_id: authorId,
            name: author.name,
            avatar_url: author.image || null,
            text: '',
          };
        }

        try {
          if (!process.env.OPENROUTER_API_KEY) {
            app.logger.warn({}, 'OPENROUTER_API_KEY not configured for member sections');
            return {
              user_id: authorId,
              name: author.name,
              avatar_url: author.image || null,
              text: 'Ein Monat voller schöner Momente.',
            };
          }

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
                  content: `Du schreibst für eine Familien-Zeitung. Schreibe 1-2 warme, persönliche Sätze auf Deutsch über ${author.name}s Monat, basierend auf diesen Beiträgen: ${postsSummary}. Sei herzlich und familiär.`,
                },
              ],
            }),
          });

          if (response.ok) {
            const data = await response.json() as { choices: Array<{ message: { content: string } }> };
            const text = data.choices[0].message.content.trim();
            app.logger.info({ authorId, textLen: text.length }, 'Generated member section');
            return {
              user_id: authorId,
              name: author.name,
              avatar_url: author.image || null,
              text,
            };
          } else {
            app.logger.warn({ status: response.status, authorId }, 'Member section AI generation failed');
            return {
              user_id: authorId,
              name: author.name,
              avatar_url: author.image || null,
              text: `${author.name} hat schöne Momente geteilt.`,
            };
          }
        } catch (error) {
          app.logger.warn({ err: error, authorId }, 'Error generating member section');
          return {
            user_id: authorId,
            name: author.name,
            avatar_url: author.image || null,
            text: `${author.name} hat schöne Momente geteilt.`,
          };
        }
      });

      const memberResults = await Promise.all(memberPromises);
      memberSections.push(...memberResults.filter(Boolean) as typeof memberSections);

      app.logger.info({ familyId, memberCount: memberSections.length }, 'Generated member sections');

      // Count active members and photos
      const uniqueAuthors = new Set(filteredPosts.map(p => p.author_id));
      const photosCount = await app.db
        .select()
        .from(schema.media)
        .where(
          and(
            eq(schema.media.family_id, familyId),
            eq(schema.media.type, 'photo')
          )
        );

      const monthPhotoCount = photosCount.filter(m => {
        const d = new Date(m.created_at);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      }).length;

      // Build newsletter content
      const monthName = new Date(year, month - 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
      const headline = `Newsletter ${monthName}`;

      const content = {
        headline,
        sections: [
          {
            icon: '📸',
            title: 'Highlights',
            items: [`${filteredPosts.length} Beiträge geteilt`],
          },
        ],
        stats: {
          posts: filteredPosts.length,
          photos: monthPhotoCount,
          members_active: uniqueAuthors.size,
        },
        closing: 'Vielen Dank, dass ihr Teil dieser Familie seid!',
        featured_photos: featuredPhotos,
        member_sections: memberSections,
      };

      // Check if newsletter already exists
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

      let newsletter;
      if (existing.length > 0) {
        app.logger.info({ newsletterId: existing[0].id }, 'Updating existing newsletter');
        const updated = await app.db
          .update(schema.newsletters)
          .set({
            content: content as any,
            generated_at: new Date(),
          })
          .where(eq(schema.newsletters.id, existing[0].id))
          .returning();
        newsletter = updated[0];
      } else {
        app.logger.info({ familyId, month, year }, 'Creating new newsletter');
        const created = await app.db
          .insert(schema.newsletters)
          .values({
            family_id: familyId,
            month,
            year,
            content: content as any,
          })
          .returning();
        newsletter = created[0];
      }

      app.logger.info({ newsletterId: newsletter.id }, 'Newsletter generated successfully');

      return reply.status(201).send({
        id: newsletter.id,
        month,
        year,
        family_id: familyId,
        content,
        generated_at: newsletter.generated_at,
      });
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
            additionalProperties: true,
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

      const familyId = familyMember[0].family_id;

      const family = await app.db
        .select()
        .from(schema.families)
        .where(eq(schema.families.id, familyId))
        .limit(1);

      if (!family.length) {
        return reply.status(404).send({ error: 'Family not found' });
      }

      const newsletter = await app.db
        .select()
        .from(schema.newsletters)
        .where(eq(schema.newsletters.family_id, familyId))
        .orderBy(desc(schema.newsletters.year), desc(schema.newsletters.month))
        .limit(1);

      if (!newsletter.length) {
        return reply.status(404).send({ error: 'No newsletters found' });
      }

      const nl = newsletter[0];
      const monthName = new Date(nl.year, nl.month - 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });

      app.logger.info({ newsletterId: nl.id }, 'Latest newsletter fetched');

      return {
        id: nl.id,
        month: monthName,
        family_name: family[0].name,
        headline: nl.content?.headline || '',
        sections: nl.content?.sections || [],
        member_sections: nl.content?.member_sections || [],
        featured_photos: nl.content?.featured_photos || [],
        stats: nl.content?.stats || { posts: 0, photos: 0, members_active: 0 },
        closing: nl.content?.closing || '',
        created_at: nl.generated_at,
      };
    }
  );

  app.fastify.get(
    '/api/newsletter/archive',
    {
      schema: {
        description: 'Get all newsletters for user family',
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
                    cover_photo: { type: ['string', 'null'] },
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Fetching newsletter archive');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const familyId = familyMember[0].family_id;

      const newsletters = await app.db
        .select()
        .from(schema.newsletters)
        .where(eq(schema.newsletters.family_id, familyId))
        .orderBy(desc(schema.newsletters.year), desc(schema.newsletters.month));

      app.logger.info({ familyId, count: newsletters.length }, 'Newsletter archive fetched');

      return {
        newsletters: newsletters.map(nl => ({
          id: nl.id,
          month: nl.month,
          year: nl.year,
          headline: nl.content?.headline || '',
          generated_at: nl.generated_at,
          cover_photo: nl.content?.featured_photos?.[0]?.url || null,
        })),
      };
    }
  );


  app.fastify.delete(
    '/api/profile',
    {
      schema: {
        description: 'Delete current user account and all associated data',
        tags: ['profile'],
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
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Deleting user account');

      const existing = await app.db
        .select()
        .from(authSchema.user)
        .where(eq(authSchema.user.id, userId))
        .limit(1);

      if (!existing.length) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Deleting the user cascades to: sessions, accounts, family_members,
      // posts, media, post_reactions, and newsletters (all have onDelete: cascade)
      await app.db
        .delete(authSchema.user)
        .where(eq(authSchema.user.id, userId));

      app.logger.info({ userId }, 'User account deleted successfully');

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
}
