CREATE TABLE "member_visibility_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"blocked_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capacity_postings" ADD COLUMN "temperature_class" text DEFAULT 'ambient' NOT NULL;--> statement-breakpoint
ALTER TABLE "capacity_postings" ADD COLUMN "adr_classes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Backfilled with a placeholder default for any pre-existing dev-seed rows, then the
-- default is dropped: new rows must always state their real loading metres explicitly (see
-- src/schema/capacityPostings.ts, which declares no .default() for this column).
ALTER TABLE "capacity_postings" ADD COLUMN "capacity_loading_metres" numeric(6, 2) NOT NULL DEFAULT '13.6';--> statement-breakpoint
ALTER TABLE "capacity_postings" ALTER COLUMN "capacity_loading_metres" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "member_visibility_blocks" ADD CONSTRAINT "member_visibility_blocks_owner_member_id_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_visibility_blocks" ADD CONSTRAINT "member_visibility_blocks_blocked_member_id_members_id_fk" FOREIGN KEY ("blocked_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_visibility_blocks_unique" ON "member_visibility_blocks" USING btree ("owner_member_id","blocked_member_id");