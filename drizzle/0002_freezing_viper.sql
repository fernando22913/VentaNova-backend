CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" "citext" NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages" USING btree ("created_at");