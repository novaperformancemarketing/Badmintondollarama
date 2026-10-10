CREATE TABLE "settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_id" integer NOT NULL,
	"to_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_id_players_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_id_players_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Payments already ticked off on session summaries count as money handed over.
INSERT INTO "settlements" ("from_id", "to_id", "amount_cents", "created_at")
SELECT p."from_id", p."to_id", p."amount_cents", COALESCE(s."ended_at", now())
FROM "payments" p JOIN "sessions" s ON s."id" = p."session_id"
WHERE p."paid" = true;
