import {
  doublePrecision,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { capacityPostings } from './capacityPostings.js';
import { members } from './members.js';
import { movements } from './movements.js';

/**
 * A proposed or accepted match between a capacity posting and a movement (see CLAUDE.md
 * vocabulary). carrierMemberId and shipperMemberId are denormalized from the posting and
 * movement so row-level security can check them directly, without a policy that itself
 * depends on another RLS-protected table's visibility.
 *
 * Score components are stored as separate named columns, never blended into one opaque
 * number — CLAUDE.md's "match explanations are mandatory". `explanation` carries the
 * human-readable detail of which hard constraints were satisfied.
 */
export const pairings = pgTable('pairings', {
  id: uuid('id').primaryKey().defaultRandom(),
  capacityPostingId: uuid('capacity_posting_id')
    .notNull()
    .references(() => capacityPostings.id),
  movementId: uuid('movement_id')
    .notNull()
    .references(() => movements.id),
  carrierMemberId: uuid('carrier_member_id')
    .notNull()
    .references(() => members.id),
  shipperMemberId: uuid('shipper_member_id')
    .notNull()
    .references(() => members.id),
  status: text('status', { enum: ['proposed', 'accepted', 'rejected', 'withdrawn'] })
    .notNull()
    .default('proposed'),
  deadheadKmAvoided: numeric('deadhead_km_avoided', { precision: 10, scale: 2 }).notNull(),
  co2eAvoidedGrams: numeric('co2e_avoided_grams', { precision: 14, scale: 2 }).notNull(),
  timeWindowSlackMinutes: integer('time_window_slack_minutes').notNull(),
  corridorDensity: doublePrecision('corridor_density').notNull(),
  historicalAcceptanceRate: doublePrecision('historical_acceptance_rate').notNull(),
  explanation: jsonb('explanation').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
