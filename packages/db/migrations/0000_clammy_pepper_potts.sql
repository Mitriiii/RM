CREATE SCHEMA "cost";
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capacity_postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"origin_site_id" uuid NOT NULL,
	"destination_site_id" uuid NOT NULL,
	"vehicle_type" text NOT NULL,
	"available_from" timestamp with time zone NOT NULL,
	"available_until" timestamp with time zone NOT NULL,
	"capacity_kg" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims_ledger" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"pairing_id" uuid,
	"claim_type" text DEFAULT 'avoided_emission' NOT NULL,
	"co2e_grams" numeric(14, 2) NOT NULL,
	"payload" jsonb NOT NULL,
	"prev_hash" text,
	"row_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost"."movement_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"rate_amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emission_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"movement_leg_id" uuid NOT NULL,
	"vehicle_type" text NOT NULL,
	"fuel_type" text NOT NULL,
	"load_profile" text NOT NULL,
	"region" text NOT NULL,
	"distance_km" numeric(10, 3) NOT NULL,
	"routing_source" text NOT NULL,
	"data_quality" text NOT NULL,
	"shipment_mass_kg" numeric(10, 2) NOT NULL,
	"leg_total_mass_kg" numeric(10, 2) NOT NULL,
	"allocation_share" double precision NOT NULL,
	"factor_set_source" text NOT NULL,
	"factor_set_version" text NOT NULL,
	"factor_set_effective_date" date NOT NULL,
	"gwp_set" text NOT NULL,
	"engine_version" text NOT NULL,
	"well_to_tank_grams" numeric(14, 4) NOT NULL,
	"tank_to_wheel_grams" numeric(14, 4) NOT NULL,
	"well_to_wheel_grams" numeric(14, 4) NOT NULL,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factor_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"version" text NOT NULL,
	"effective_date" date NOT NULL,
	"gwp_set" text NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"origin_site_id" uuid NOT NULL,
	"destination_site_id" uuid NOT NULL,
	"vehicle_type" text NOT NULL,
	"fuel_type" text NOT NULL,
	"load_profile" text NOT NULL,
	"region" text NOT NULL,
	"distance_km" numeric(10, 3) NOT NULL,
	"routing_source" text NOT NULL,
	"departure_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"country_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movement_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_id" uuid NOT NULL,
	"leg_id" uuid NOT NULL,
	"sequence_index" integer NOT NULL,
	"shipment_mass_kg" numeric(10, 2) NOT NULL,
	"data_quality" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"origin_site_id" uuid NOT NULL,
	"destination_site_id" uuid NOT NULL,
	"equipment_type" text NOT NULL,
	"mass_kg" numeric(10, 2) NOT NULL,
	"pickup_window_start" timestamp with time zone NOT NULL,
	"pickup_window_end" timestamp with time zone NOT NULL,
	"delivery_window_start" timestamp with time zone NOT NULL,
	"delivery_window_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capacity_posting_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"carrier_member_id" uuid NOT NULL,
	"shipper_member_id" uuid NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"deadhead_km_avoided" numeric(10, 2) NOT NULL,
	"co2e_avoided_grams" numeric(14, 2) NOT NULL,
	"time_window_slack_minutes" integer NOT NULL,
	"corridor_density" double precision NOT NULL,
	"historical_acceptance_rate" double precision NOT NULL,
	"explanation" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address_line" text NOT NULL,
	"city" text NOT NULL,
	"country_code" text NOT NULL,
	-- drizzle-kit generates `geometry(point)` here, silently dropping the srid:4326 declared
	-- in src/schema/sites.ts (a known drizzle-kit codegen gap, not a schema.ts change) —
	-- hand-patched to enforce WGS84 at the column level. See docs/decisions/0002.
	"location" geometry(point, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_postings" ADD CONSTRAINT "capacity_postings_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_postings" ADD CONSTRAINT "capacity_postings_origin_site_id_sites_id_fk" FOREIGN KEY ("origin_site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_postings" ADD CONSTRAINT "capacity_postings_destination_site_id_sites_id_fk" FOREIGN KEY ("destination_site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims_ledger" ADD CONSTRAINT "claims_ledger_owner_member_id_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims_ledger" ADD CONSTRAINT "claims_ledger_pairing_id_pairings_id_fk" FOREIGN KEY ("pairing_id") REFERENCES "public"."pairings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost"."movement_costs" ADD CONSTRAINT "movement_costs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost"."movement_costs" ADD CONSTRAINT "movement_costs_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emission_records" ADD CONSTRAINT "emission_records_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emission_records" ADD CONSTRAINT "emission_records_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emission_records" ADD CONSTRAINT "emission_records_movement_leg_id_movement_legs_id_fk" FOREIGN KEY ("movement_leg_id") REFERENCES "public"."movement_legs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emission_records" ADD CONSTRAINT "emission_records_supersedes_id_emission_records_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."emission_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legs" ADD CONSTRAINT "legs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legs" ADD CONSTRAINT "legs_origin_site_id_sites_id_fk" FOREIGN KEY ("origin_site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legs" ADD CONSTRAINT "legs_destination_site_id_sites_id_fk" FOREIGN KEY ("destination_site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_legs" ADD CONSTRAINT "movement_legs_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_legs" ADD CONSTRAINT "movement_legs_leg_id_legs_id_fk" FOREIGN KEY ("leg_id") REFERENCES "public"."legs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_origin_site_id_sites_id_fk" FOREIGN KEY ("origin_site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_destination_site_id_sites_id_fk" FOREIGN KEY ("destination_site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_capacity_posting_id_capacity_postings_id_fk" FOREIGN KEY ("capacity_posting_id") REFERENCES "public"."capacity_postings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_carrier_member_id_members_id_fk" FOREIGN KEY ("carrier_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_shipper_member_id_members_id_fk" FOREIGN KEY ("shipper_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "claims_ledger_id_unique" ON "claims_ledger" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "factor_sets_natural_key" ON "factor_sets" USING btree ("source","version","effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "movement_legs_movement_leg_unique" ON "movement_legs" USING btree ("movement_id","leg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");