-- Backfilled with a placeholder for any pre-existing dev-seed rows, then the default is
-- dropped: new rows must always state a real city name explicitly (see
-- src/schema/capacityPostings.ts, which declares no .default() for these columns).
ALTER TABLE "capacity_postings" ADD COLUMN "origin_city" text NOT NULL DEFAULT 'Unknown';--> statement-breakpoint
ALTER TABLE "capacity_postings" ALTER COLUMN "origin_city" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "capacity_postings" ADD COLUMN "destination_city" text NOT NULL DEFAULT 'Unknown';--> statement-breakpoint
ALTER TABLE "capacity_postings" ALTER COLUMN "destination_city" DROP DEFAULT;
