import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * A member is a company in the network — shipper, carrier group, or 3PL. Never freelance
 * drivers, never "user" for the company (see CLAUDE.md vocabulary).
 *
 * Deliberately has no row-level security: the Exchange only works if members can see who
 * else is in the network to request pairings with. This is the one exception to per-tenant
 * isolation, and it is a name/kind/country row only — no rate, price, or shipment data lives
 * here. See docs/decisions/0002-tenancy-and-cost-isolation.md.
 */
export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['shipper', 'carrier', '3pl'] }).notNull(),
  countryCode: text('country_code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
