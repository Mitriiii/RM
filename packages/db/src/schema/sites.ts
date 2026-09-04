import { geometry, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { members } from './members.js';

/** A physical location (depot, warehouse, terminal) a member operates from. Row-level security scoped by memberId. */
export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  name: text('name').notNull(),
  addressLine: text('address_line').notNull(),
  city: text('city').notNull(),
  countryCode: text('country_code').notNull(),
  location: geometry('location', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
