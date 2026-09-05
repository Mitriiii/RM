import { pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { members } from './members.js';

/**
 * The concrete backing for CLAUDE.md's "member visibility permissions" hard constraint and
 * packages/matching's `MatchContext.isVisible` — previously an abstract injected callback
 * with no real data behind it anywhere in this codebase. One row means "ownerMemberId does
 * not want blockedMemberId to see ownerMemberId's capacity postings" — the default, absent
 * any row, is full network visibility (capacity_postings' own README: "a posting exists to
 * be found"). This is a visibility preference a member sets about their own postings, not a
 * security boundary between unrelated tenants' private data — RLS still scopes writes to
 * the owning member; see migrations/0001_policies.sql's capacity_postings policy for how
 * reads are filtered using this table.
 */
export const memberVisibilityBlocks = pgTable(
  'member_visibility_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerMemberId: uuid('owner_member_id')
      .notNull()
      .references(() => members.id),
    blockedMemberId: uuid('blocked_member_id')
      .notNull()
      .references(() => members.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('member_visibility_blocks_unique').on(table.ownerMemberId, table.blockedMemberId),
  ],
);
