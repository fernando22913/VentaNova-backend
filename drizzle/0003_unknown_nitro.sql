-- Hand-authored bits drizzle-kit 0.31 omits:
--   1. the new `contact_status` enum type (pgEnum), and
--   2. adding WORKER to the pre-existing `user_role` enum.
ALTER TYPE "public"."user_role" ADD VALUE 'WORKER';
--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('OPEN', 'RESOLVED');
--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "status" "contact_status" DEFAULT 'OPEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "reply" text;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "replied_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "replied_by" uuid;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_replied_by_users_id_fk" FOREIGN KEY ("replied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_messages_status_idx" ON "contact_messages" USING btree ("status");
