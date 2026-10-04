ALTER TABLE "session_players" ADD COLUMN "shares_with" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "bracket" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "group_key" text;--> statement-breakpoint
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_shares_with_players_id_fk" FOREIGN KEY ("shares_with") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;