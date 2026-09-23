ALTER TYPE "public"."media_type" ADD VALUE 'game';--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "external_url" text;