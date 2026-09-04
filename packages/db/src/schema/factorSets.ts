import { date, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Metadata for a factor set known to the system — mirrors packages/factors's FactorSetId.
 * The actual numeric factor values live in versioned JSON files (see
 * packages/factors/data/README.md), not here; this table exists so emission_records can
 * carry a verified FK-checkable reference to (source, version, effectiveDate), and so the
 * verification checklist in that README has somewhere to record its result.
 *
 * Deliberately has no row-level security — a factor set is shared reference data, not a
 * member's private information.
 */
export const factorSets = pgTable(
  'factor_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    version: text('version').notNull(),
    effectiveDate: date('effective_date').notNull(),
    gwpSet: text('gwp_set').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: text('verified_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('factor_sets_natural_key').on(table.source, table.version, table.effectiveDate),
  ],
);
