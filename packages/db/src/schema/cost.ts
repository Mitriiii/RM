import { numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { members } from './members.js';
import { movements } from './movements.js';

/**
 * CLAUDE.md non-negotiable #6: no rate or price data is ever visible between members — not
 * in the UI, not in an API response, not in a log line, not in an error message. Putting
 * cost data in its own Postgres schema, never `public`, means a mistake elsewhere in this
 * codebase (an errant `SELECT *`, an ORM eager-load, a debug log of a full row) cannot leak
 * it: nothing outside this schema can reference these tables without deliberately qualifying
 * `cost.movement_costs`, and row-level security here is stricter than everywhere else — see
 * migrations/0001_policies.sql.
 */
export const costSchema = pgSchema('cost');

export const movementCosts = costSchema.table('movement_costs', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  movementId: uuid('movement_id')
    .notNull()
    .references(() => movements.id),
  rateAmount: numeric('rate_amount', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
