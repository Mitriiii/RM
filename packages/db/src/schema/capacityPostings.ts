import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { members } from './members.js';
import { sites } from './sites.js';

/**
 * A member declaring a truck available on a route and time window (see CLAUDE.md
 * vocabulary). Deliberately readable network-wide — a posting exists to be found — but
 * writable only by the owning carrier. Never a load board: no rate, price, or
 * cost-to-carrier field exists here, and none should ever be added (see kickoff Session 9's
 * guardrails).
 *
 * Fields are exactly the hard constraints CLAUDE.md's matcher section lists that a posting
 * (as opposed to a movement) actually carries: equipment type, temperature class, ADR
 * classes, gross-weight capacity, loading metres, and a time window. Loading/unloading
 * dwell is a *movement* property (see packages/matching's MovementCandidateInput), not a
 * posting one — a posting only states when the truck is available, not how any specific
 * future movement's dwell needs fit inside that window; that fitting is
 * evaluateTimeWindowFeasibility's job at match time, not something this form asks about.
 */
export const capacityPostings = pgTable('capacity_postings', {
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
  /**
   * Denormalized from the origin/destination sites at creation time, for the same reason
   * pairings denormalizes carrierMemberId/shipperMemberId: `sites` is tenant-scoped RLS
   * (member_id = current_member_id()), so a viewer reading someone else's posting could never
   * join out to that poster's own site row to show a city name. These are plain, non-sensitive
   * city names, not an address — safe to read network-wide alongside the rest of this row.
   */
  originCity: text('origin_city').notNull(),
  destinationCity: text('destination_city').notNull(),
  vehicleType: text('vehicle_type').notNull(),
  temperatureClass: text('temperature_class', { enum: ['ambient', 'chilled', 'frozen'] })
    .notNull()
    .default('ambient'),
  /** Empty array means no dangerous-goods certification — matches
   * packages/matching's EquipmentSpec.adrClasses semantics exactly. */
  adrClasses: text('adr_classes').array().notNull().default([]),
  availableFrom: timestamp('available_from', { withTimezone: true }).notNull(),
  availableUntil: timestamp('available_until', { withTimezone: true }).notNull(),
  capacityKg: numeric('capacity_kg', { precision: 10, scale: 2 }).notNull(),
  capacityLoadingMetres: numeric('capacity_loading_metres', { precision: 6, scale: 2 }).notNull(),
  status: text('status', { enum: ['open', 'withdrawn', 'filled'] })
    .notNull()
    .default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
