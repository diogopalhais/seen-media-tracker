CREATE TABLE "play_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_item_id" uuid NOT NULL,
	"source" text NOT NULL,
	"played_on" date NOT NULL,
	"minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "play_sessions_minutes_check" CHECK ("play_sessions"."minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "steam_games" (
	"app_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon_hash" text,
	"minutes_total" integer DEFAULT 0 NOT NULL,
	"minutes_recent" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	"media_item_id" uuid,
	"matched_at" timestamp with time zone,
	"minutes_recorded" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steam_games" ADD CONSTRAINT "steam_games_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "play_sessions_item_source_day_uidx" ON "play_sessions" USING btree ("media_item_id","source","played_on");--> statement-breakpoint
CREATE INDEX "play_sessions_played_idx" ON "play_sessions" USING btree ("played_on" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "steam_games_item_idx" ON "steam_games" USING btree ("media_item_id");