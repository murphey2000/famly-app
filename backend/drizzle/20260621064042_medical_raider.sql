ALTER TABLE "posts" DROP CONSTRAINT "ai_status_check";--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "ai_status" SET DEFAULT 'draft';--> statement-breakpoint
UPDATE "posts" SET "ai_status" = 'draft' WHERE "ai_status" NOT IN ('draft', 'published', 'error');--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "ai_status_check" CHECK ("ai_status" IN ('draft', 'published', 'error'));