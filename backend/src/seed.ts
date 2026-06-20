import { createApplication } from '@specific-dev/framework';
import { eq } from 'drizzle-orm';
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';

const schema = { ...appSchema, ...authSchema };

export const app = await createApplication(schema);

const db = app.db;

async function seed() {
  console.log('Starting seed...');

  try {
    // Create demo user
    const demoUser = await db
      .insert(authSchema.user)
      .values({
        id: 'demo-user-1',
        name: 'Thomas Greiling',
        email: 'thomas@greiling.family',
        emailVerified: true,
      })
      .onConflictDoNothing()
      .returning();

    console.log('Demo user created/exists:', demoUser);

    // Create demo family
    const family = await db
      .insert(appSchema.families)
      .values({
        name: 'Familie Greiling',
        invite_code: 'GRL001',
        created_by: 'demo-user-1',
      })
      .onConflictDoNothing()
      .returning();

    console.log('Family created/exists:', family);

    if (family.length === 0) {
      console.log('Family already exists, fetching it...');
      const existing = await db
        .select()
        .from(appSchema.families)
        .where(eq(appSchema.families.invite_code, 'GRL001'))
        .limit(1);
      family.push(existing[0]);
    }

    const familyId = family[0].id;

    // Add demo user to family as admin
    await db
      .insert(appSchema.family_members)
      .values({
        family_id: familyId,
        user_id: 'demo-user-1',
        role: 'admin',
      })
      .onConflictDoNothing();

    console.log('Demo user added to family');

    // Create demo posts
    const post1 = await db
      .insert(appSchema.posts)
      .values({
        family_id: familyId,
        author_id: 'demo-user-1',
        raw_text: 'Julia hat heute ihren 13. Geburtstag gefeiert! Wir haben eine große Party gemacht mit allen Freunden.',
        ai_title: 'Julias 13. Geburtstag',
        ai_story:
          'Julia strahlt heute über das ganze Gesicht – sie feiert ihren 13. Geburtstag! Die ganze Familie und alle ihre Freunde sind zusammengekommen, um diesen besonderen Tag zu feiern. Mit Kuchen, Musik und viel Lachen wird dieser Tag unvergesslich bleiben.',
        ai_status: 'done',
        event_date: new Date('2024-06-15T14:00:00Z'),
        tags: ['birthday', 'julia', 'party'],
      })
      .returning();

    const post2 = await db
      .insert(appSchema.posts)
      .values({
        family_id: familyId,
        author_id: 'demo-user-1',
        raw_text: 'Erster Schultag von Max in der 1. Klasse. Er war so aufgeregt und hatte seinen neuen Rucksack dabei.',
        ai_title: "Max' erster Schultag",
        ai_story:
          'Heute ist ein großer Tag für Max – er geht zum ersten Mal in die Schule! Mit seinem nagelneuen Rucksack und leuchtenden Augen macht er sich auf den Weg in einen neuen Lebensabschnitt. Die ganze Familie ist so stolz auf ihn.',
        ai_status: 'done',
        event_date: new Date('2024-09-02T08:00:00Z'),
        tags: ['school', 'max', 'milestone'],
      })
      .returning();

    const post3 = await db
      .insert(appSchema.posts)
      .values({
        family_id: familyId,
        author_id: 'demo-user-1',
        raw_text: 'Wir waren am Wochenende in den Bergen wandern. Das Wetter war perfekt und die Aussicht atemberaubend.',
        ai_title: 'Wanderausflug in den Bergen',
        ai_story:
          'Ein perfektes Wochenende in den Bergen liegt hinter uns! Bei strahlendem Sonnenschein erkunden wir gemeinsam die wunderschönen Wanderwege. Die atemberaubende Aussicht vom Gipfel macht alle Mühen vergessen – solche Momente schweißen die Familie zusammen.',
        ai_status: 'done',
        event_date: new Date('2024-08-10T10:00:00Z'),
        tags: ['hiking', 'nature', 'weekend'],
      })
      .returning();

    console.log('Demo posts created');

    // Create demo media
    await db
      .insert(appSchema.media)
      .values({
        post_id: post1[0].id,
        family_id: familyId,
        uploader_id: 'demo-user-1',
        type: 'photo',
        url: 'https://picsum.photos/seed/birthday/800/600',
        thumbnail_url: 'https://picsum.photos/seed/birthday/400/300',
      });

    await db
      .insert(appSchema.media)
      .values({
        post_id: post2[0].id,
        family_id: familyId,
        uploader_id: 'demo-user-1',
        type: 'photo',
        url: 'https://picsum.photos/seed/school/800/600',
        thumbnail_url: 'https://picsum.photos/seed/school/400/300',
      });

    await db
      .insert(appSchema.media)
      .values({
        post_id: post3[0].id,
        family_id: familyId,
        uploader_id: 'demo-user-1',
        type: 'photo',
        url: 'https://picsum.photos/seed/hiking/800/600',
        thumbnail_url: 'https://picsum.photos/seed/hiking/400/300',
      });

    await db
      .insert(appSchema.media)
      .values({
        post_id: post3[0].id,
        family_id: familyId,
        uploader_id: 'demo-user-1',
        type: 'photo',
        url: 'https://picsum.photos/seed/mountain/800/600',
        thumbnail_url: 'https://picsum.photos/seed/mountain/400/300',
      });

    console.log('Demo media created');
    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

seed();
