CREATE TYPE "public"."media_type" AS ENUM('movie', 'tv');--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_type" "media_type" NOT NULL,
	"tmdb_id" integer NOT NULL,
	"title" text NOT NULL,
	"original_title" text NOT NULL,
	"release_year" integer,
	"release_date" date,
	"poster_path" text,
	"backdrop_path" text,
	"overview" text DEFAULT '' NOT NULL,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"runtime_minutes" integer,
	"number_of_seasons" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "watch_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_item_id" uuid NOT NULL,
	"watched_on" date NOT NULL,
	"rating" smallint,
	"season" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_entries_rating_check" CHECK ("watch_entries"."rating" is null or ("watch_entries"."rating" between 1 and 10)),
	CONSTRAINT "watch_entries_season_check" CHECK ("watch_entries"."season" is null or "watch_entries"."season" >= 0)
);
--> statement-breakpoint
ALTER TABLE "watch_entries" ADD CONSTRAINT "watch_entries_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_items_type_tmdb_uidx" ON "media_items" USING btree ("media_type","tmdb_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uidx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "watch_entries_watched_idx" ON "watch_entries" USING btree ("watched_on" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "watch_entries_item_idx" ON "watch_entries" USING btree ("media_item_id");