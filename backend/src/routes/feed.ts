import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, inArray } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

export function registerFeedRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get(
    '/api/feed',
    {
      schema: {
        description: 'Get family feed with posts and birthdays',
        tags: ['feed'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
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

      app.logger.info({ userId: session.user.id }, 'Fetching feed');

      const familyMember = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.user_id, session.user.id))
        .limit(1);

      if (!familyMember.length) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const familyId = familyMember[0].family_id;

      // Fetch all posts for the family
      const posts = await app.db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.family_id, familyId))
        .orderBy(desc(schema.posts.created_at));

      // Fetch all media for posts
      const postIds = posts.map((p) => p.id);
      const allMedia =
        postIds.length > 0
          ? await app.db
              .select()
              .from(schema.media)
              .where(inArray(schema.media.post_id, postIds))
          : [];

      // Group media by post_id
      const mediaByPostId = new Map<string, typeof allMedia>();
      for (const m of allMedia) {
        if (!mediaByPostId.has(m.post_id)) {
          mediaByPostId.set(m.post_id, []);
        }
        mediaByPostId.get(m.post_id)!.push(m);
      }

      // Fetch all authors
      const authorIds = [...new Set(posts.map((p) => p.author_id))];
      const authors =
        authorIds.length > 0
          ? await app.db
              .select()
              .from(authSchema.user)
              .where(inArray(authSchema.user.id, authorIds))
          : [];
      const authorMap = new Map(authors.map((a) => [a.id, a]));

      // Fetch all family members for birthday computation
      const members = await app.db
        .select()
        .from(schema.family_members)
        .where(eq(schema.family_members.family_id, familyId));

      // Helper to compute days until birthday
      function daysUntilBirthday(birthdayStr: string | null | undefined): { daysUntil: number; age: number | null } | null {
        if (!birthdayStr) return null;

        const today = new Date();
        const thisYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();

        // Parse birthday: can be 'YYYY-MM-DD' or 'MM-DD'
        const parts = birthdayStr.split('-');
        let birthMonth: number, birthDate: number, birthYear: number | null;

        if (parts.length === 3) {
          birthYear = parseInt(parts[0], 10);
          birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
          birthDate = parseInt(parts[2], 10);
        } else if (parts.length === 2) {
          birthYear = null;
          birthMonth = parseInt(parts[0], 10) - 1;
          birthDate = parseInt(parts[1], 10);
        } else {
          return null;
        }

        // Compute next birthday
        let nextBirthday = new Date(thisYear, birthMonth, birthDate);
        if (nextBirthday.getTime() < new Date(thisYear, todayMonth, todayDate).getTime()) {
          nextBirthday = new Date(thisYear + 1, birthMonth, birthDate);
        }

        const diffMs = nextBirthday.getTime() - new Date(thisYear, todayMonth, todayDate).getTime();
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Compute age if birth year is available
        let age: number | null = null;
        if (birthYear) {
          age = thisYear - birthYear;
          if (birthMonth > todayMonth || (birthMonth === todayMonth && birthDate > todayDate)) {
            age--;
          }
        }

        return { daysUntil, age };
      }

      // Identify birthdays in next 7 days
      const birthdayItems: Array<any> = [];
      for (const member of members) {
        const bday = daysUntilBirthday(member.birthday);
        if (bday && bday.daysUntil >= 0 && bday.daysUntil <= 7) {
          const author = authorMap.get(member.user_id);
          birthdayItems.push({
            kind: 'birthday',
            member: {
              id: member.user_id,
              name: author?.name || '',
              image: author?.image || null,
            },
            daysUntil: bday.daysUntil,
            age: bday.age,
          });
        }
      }

      // Identify memory posts (same month+day but earlier year)
      const memoryMap = new Map<number, Array<any>>();
      for (const post of posts) {
        if (!post.event_date) continue;

        const postDate = new Date(post.event_date);
        const postMonth = postDate.getMonth();
        const postDate_ = postDate.getDate();
        const postYear = postDate.getFullYear();

        const today = new Date();
        if (postMonth === today.getMonth() && postDate_ === today.getDate() && postYear < today.getFullYear()) {
          const key = postYear;
          if (!memoryMap.has(key)) {
            memoryMap.set(key, []);
          }
          memoryMap.get(key)!.push(post);
        }
      }

      // Assemble feed
      const feed: Array<any> = [];

      // 1. Urgent birthdays (0-3 days)
      const urgentBirthdays = birthdayItems.filter((b) => b.daysUntil >= 0 && b.daysUntil <= 3).sort((a, b) => a.daysUntil - b.daysUntil);
      feed.push(...urgentBirthdays);

      // 2. Posts with memory items inserted after every 5th post
      let postCount = 0;
      for (const post of posts) {
        if (memoryMap.has(post.event_date ? new Date(post.event_date).getFullYear() : -1)) {
          for (const memPost of memoryMap.get(post.event_date ? new Date(post.event_date).getFullYear() : -1)!) {
            if (post.id === memPost.id) continue; // Don't duplicate
          }
        }

        const author = authorMap.get(post.author_id);
        const media = mediaByPostId.get(post.id) || [];

        feed.push({
          kind: 'post',
          id: post.id,
          family_id: post.family_id,
          author_id: post.author_id,
          raw_text: post.raw_text,
          ai_title: post.ai_title,
          ai_story: post.ai_story,
          ai_status: post.ai_status,
          event_date: post.event_date,
          tags: post.tags,
          created_at: post.created_at,
          updated_at: post.updated_at,
          author: {
            id: post.author_id,
            name: author?.name || '',
            image: author?.image || null,
          },
          media: media.map((m) => ({
            id: m.id,
            url: m.url,
            type: m.type,
            thumbnail_url: m.thumbnail_url,
          })),
        });

        postCount++;

        // Insert memory posts after every 5th post
        if (postCount % 5 === 0) {
          for (const year of Array.from(memoryMap.keys()).sort((a, b) => b - a)) {
            for (const memPost of memoryMap.get(year)!) {
              const author = authorMap.get(memPost.author_id);
              const media = mediaByPostId.get(memPost.id) || [];

              feed.push({
                kind: 'memory',
                year,
                post: {
                  id: memPost.id,
                  family_id: memPost.family_id,
                  author_id: memPost.author_id,
                  raw_text: memPost.raw_text,
                  ai_title: memPost.ai_title,
                  ai_story: memPost.ai_story,
                  ai_status: memPost.ai_status,
                  event_date: memPost.event_date,
                  tags: memPost.tags,
                  created_at: memPost.created_at,
                  updated_at: memPost.updated_at,
                  author: {
                    id: memPost.author_id,
                    name: author?.name || '',
                    image: author?.image || null,
                  },
                  media: media.map((m) => ({
                    id: m.id,
                    url: m.url,
                    type: m.type,
                    thumbnail_url: m.thumbnail_url,
                  })),
                },
              });
            }
          }
        }
      }

      // 3. Upcoming birthdays (4-7 days)
      const upcomingBirthdays = birthdayItems.filter((b) => b.daysUntil >= 4 && b.daysUntil <= 7).sort((a, b) => a.daysUntil - b.daysUntil);
      feed.push(...upcomingBirthdays);

      app.logger.info({ familyId, feedLength: feed.length }, 'Feed retrieved');

      return feed;
    }
  );
}
