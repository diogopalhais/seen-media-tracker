ALTER TABLE "media_items" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "last_episode_season" integer;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "last_episode_number" integer;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "last_episode_name" text;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "last_episode_air_date" date;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "next_episode_season" integer;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "next_episode_number" integer;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "next_episode_name" text;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "next_episode_air_date" date;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "metadata_refreshed_at" timestamp with time zone;