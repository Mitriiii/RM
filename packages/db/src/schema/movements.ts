import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { members } from './members.js';
import { sites } from './sites.js';

/**
 * One physical transport of goods from A to B (see CLAUDE.md vocabulary). Owned by the
 * shipper member. Row-level security scoped by memberId.
 */
export const movements = pgTable('movements', {
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
  equipmentType: text('equipment_type').notNull(),
  massKg: numeric('mass_kg', { precision: 10, scale: 2 }).notNull(),
  pickupWindowStart: timestamp('pickup_window_start', { withTimezone: true }).notNull(),
  pickupWindowEnd: timestamp('pickup_window_end', { withTimezone: true }).notNull(),
  deliveryWindowStart: timestamp('delivery_window_start', { withTimezone: true }).notNull(),
  deliveryWindowEnd: timestamp('delivery_window_end', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
