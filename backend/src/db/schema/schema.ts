import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  json,
  check,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth-schema.js';

export const families = pgTable('families', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  invite_code: text('invite_code').notNull().unique(),
  created_by: text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const family_members = pgTable('family_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  family_id: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  birthday: text('birthday'),
}, (table) => [
  check('role_check', sql`"role" IN ('admin', 'member')`),
  unique('family_members_unique').on(table.family_id, table.user_id),
]);

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  family_id: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  author_id: text('author_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  raw_text: text('raw_text'),
  ai_title: text('ai_title'),
  ai_story: text('ai_story'),
  ai_status: text('ai_status').notNull().default('draft'),
  event_date: timestamp('event_date', { withTimezone: true }),
  tags: json('tags').default([]).$type<string[]>(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('ai_status_check', sql`"ai_status" IN ('draft', 'published', 'error')`),
]);

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  post_id: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  family_id: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  uploader_id: text('uploader_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  url: text('url').notNull(),
  thumbnail_url: text('thumbnail_url'),
  storage_key: text('storage_key'),
  thumbnail_key: text('thumbnail_key'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('media_type_check', sql`"type" IN ('photo', 'video', 'audio')`),
]);

export const post_reactions = pgTable('post_reactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  post_id: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('post_reactions_unique').on(table.post_id, table.user_id, table.emoji),
]);

export const newsletters = pgTable('newsletters', {
  id: uuid('id').primaryKey().defaultRandom(),
  family_id: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  content: json('content').$type<{
    headline: string;
    sections: Array<{ icon: string; title: string; items: string[] }>;
    stats: { posts: number; photos: number; members_active: number };
    closing: string;
  }>(),
  generated_at: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('newsletters_unique').on(table.family_id, table.month, table.year),
]);
