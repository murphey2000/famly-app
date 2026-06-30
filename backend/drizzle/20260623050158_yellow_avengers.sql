ALTER TABLE "posts" DROP CONSTRAINT "ai_status_check";--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "ai_status" SET DEFAULT 'pending';--> statement-breakpoint
UPDATE "posts" SET "ai_status" = 'pending' WHERE "ai_status" = 'draft';--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "ai_status_check" CHECK ("ai_status" IN ('pending', 'generating', 'done', 'published', 'error'));