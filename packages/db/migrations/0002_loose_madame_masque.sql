CREATE TABLE "routing_distance_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin_longitude" double precision NOT NULL,
	"origin_latitude" double precision NOT NULL,
	"destination_longitude" double precision NOT NULL,
	"destination_latitude" double precision NOT NULL,
	"profile" text NOT NULL,
	"routing_engine_version" text NOT NULL,
	"distance_km" numeric(10, 3) NOT NULL,
	"duration_seconds" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "routing_distance_cache_key_unique" ON "routing_distance_cache" USING btree ("origin_longitude","origin_latitude","destination_longitude","destination_latitude","profile","routing_engine_version");