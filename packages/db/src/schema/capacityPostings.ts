import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { members } from './members.js';
import { sites } from './sites.js';

/**
 * A member declaring a truck available on a route and time window (see CLAUDE.md
 * vocabulary). Deliberately readable network-wide — a posting exists to be found — but
 * writable only by the owning carrier. Never a load board: no rate is posted here.
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
  vehicleType: text('vehicle_type').notNull(),
  availableFrom: timestamp('available_from', { withTimezone: true }).notNull(),
  availableUntil: timestamp('available_until', { withTimezone: true }).notNull(),
  capacityKg: numeric('capacity_kg', { precision: 10, scale: 2 }).notNull(),
  status: text('status', { enum: ['open', 'withdrawn', 'filled'] })
    .notNull()
    .default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
