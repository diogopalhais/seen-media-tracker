CREATE TABLE "episode_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_item_id" uuid NOT NULL,
	"season_number" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"watched_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "episode_watches_numbers_check" CHECK ("episode_watches"."season_number" >= 0 and "episode_watches"."episode_number" >= 0)
);
--> statement-breakpoint
ALTER TABLE "episode_watches" ADD CONSTRAINT "episode_watches_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "episode_watches_item_episode_uidx" ON "episode_watches" USING btree ("media_item_id","season_number","episode_number");--> statement-breakpoint
CREATE INDEX "episode_watches_watched_idx" ON "episode_watches" USING btree ("watched_on" DESC NULLS LAST,"created_at" DESC NULLS LAST);