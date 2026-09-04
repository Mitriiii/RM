import {
  bigserial,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { members } from './members.js';
import { pairings } from './pairings.js';

/**
 * A registered, ID'd assertion of avoided emissions (see CLAUDE.md vocabulary). Append-only
 * and hash-chained: `prevHash`/`rowHash` are computed by the
 * claims_ledger_chain trigger (migrations/0001_policies.sql), never by application code, and
 * UPDATE/DELETE are rejected outright by claims_ledger_append_only. Use
 * `verify_claims_chain()` to walk the chain and detect tampering.
 *
 * `seq` is a single global, strictly increasing order across every member's claims — the
 * chain is one shared ledger, not one per member, because double-counting prevention (no two
 * members claiming the same avoided kilometre) requires one canonical order. Row-level
 * security still scopes ordinary reads to `ownerMemberId`; only the SECURITY DEFINER
 * verification function sees the whole chain.
 *
 * A correction is a new row whose `payload` references the id it supersedes — the ledger
 * itself has no supersedesId column, because "superseding" a claim is itself a claim
 * (typically a member's own audit trail, not a schema-level relationship); see
 * docs/methodology.md if that assumption needs revisiting once real claims exist.
 */
export const claimsLedger = pgTable(
  'claims_ledger',
  {
    seq: bigserial('seq', { mode: 'number' }).primaryKey(),
    id: uuid('id').notNull().defaultRandom(),
    ownerMemberId: uuid('owner_member_id')
      .notNull()
      .references(() => members.id),
    pairingId: uuid('pairing_id').references(() => pairings.id),
    claimType: text('claim_type', { enum: ['avoided_emission'] })
      .notNull()
      .default('avoided_emission'),
    co2eGrams: numeric('co2e_grams', { precision: 14, scale: 2 }).notNull(),
    payload: jsonb('payload').notNull(),
    prevHash: text('prev_hash'),
    // Always overwritten by the claims_ledger_chain trigger, regardless of what (if anything)
    // the application supplies — the default only exists so the app-facing insert type
    // doesn't require callers to compute a hash they must never be trusted to compute.
    rowHash: text('row_hash').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('claims_ledger_id_unique').on(table.id)],
);
