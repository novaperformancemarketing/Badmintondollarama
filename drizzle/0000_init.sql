CREATE TABLE "byes" (
	"session_id" integer NOT NULL,
	"round" integer NOT NULL,
	"player_id" integer NOT NULL,
	CONSTRAINT "byes_session_id_round_player_id_pk" PRIMARY KEY("session_id","round","player_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"round" integer NOT NULL,
	"court" integer NOT NULL,
	"a1" integer NOT NULL,
	"a2" integer NOT NULL,
	"b1" integer NOT NULL,
	"b2" integer NOT NULL,
	"winner" text,
	"score_a" integer,
	"score_b" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"from_id" integer NOT NULL,
	"to_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "session_players" (
	"session_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "session_players_session_id_player_id_pk" PRIMARY KEY("session_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"played_on" date NOT NULL,
	"stake_cents" integer DEFAULT 100 NOT NULL,
	"courts" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "byes" ADD CONSTRAINT "byes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byes" ADD CONSTRAINT "byes_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_a1_players_id_fk" FOREIGN KEY ("a1") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_a2_players_id_fk" FOREIGN KEY ("a2") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_b1_players_id_fk" FOREIGN KEY ("b1") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_b2_players_id_fk" FOREIGN KEY ("b2") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_from_id_players_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_to_id_players_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_session_idx" ON "games" USING btree ("session_id","round");