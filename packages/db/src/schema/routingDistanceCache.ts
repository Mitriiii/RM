import {
  doublePrecision,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * The persistent implementation of @freyo/routing's DistanceCache, keyed by (origin,
 * destination, profile, routingEngineVersion) — see CLAUDE.md. A routed distance between two
 * coordinates is a geographic fact, not one member's private information, so — like
 * members/factor_sets — this table deliberately has no row-level security; it's shared
 * reference data every member benefits from reusing.
 *
 * Coordinates are stored rounded to the same precision @freyo/routing's roundCoordinate uses
 * (see src/routingCache.ts), so this table and an in-memory DistanceCache always agree on
 * whether two coordinates count as "the same" for caching purposes.
 */
export const routingDistanceCache = pgTable(
  'routing_distance_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    originLongitude: doublePrecision('origin_longitude').notNull(),
    originLatitude: doublePrecision('origin_latitude').notNull(),
    destinationLongitude: doublePrecision('destination_longitude').notNull(),
    destinationLatitude: doublePrecision('destination_latitude').notNull(),
    profile: text('profile').notNull(),
    routingEngineVersion: text('routing_engine_version').notNull(),
    distanceKm: numeric('distance_km', { precision: 10, scale: 3 }).notNull(),
    durationSeconds: doublePrecision('duration_seconds').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('routing_distance_cache_key_unique').on(
      table.originLongitude,
      table.originLatitude,
      table.destinationLongitude,
      table.destinationLatitude,
      table.profile,
      table.routingEngineVersion,
    ),
  ],
);
