import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { members } from './members.js';
import { sites } from './sites.js';

/**
 * One transport chain element: a single vehicle movement operated by a carrier member,
 * belonging to one transport operation category (vehicle type, fuel, load profile, region —
 * see packages/factors and CLAUDE.md). A leg may carry more than one movement's shipment at
 * once (a pooled backhaul); see movement_legs. Row-level security scoped by memberId (the
 * operating carrier).
 */
export const legs = pgTable('legs', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  originSiteId: uuid('origin_site_id')
    .notNull()
    .references(() => sites.id),
  destinationSiteId: uuid('destination_site_id')
    .notNull()
    .references(() => sites.id),
  vehicleType: text('vehicle_type').notNull(),
  fuelType: text('fuel_type').notNull(),
  loadProfile: text('load_profile').notNull(),
  region: text('region').notNull(),
  distanceKm: numeric('distance_km', { precision: 10, scale: 3 }).notNull(),
  routingSource: text('routing_source').notNull(),
  departureAt: timestamp('departure_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
