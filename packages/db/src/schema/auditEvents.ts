import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { members } from './members.js';
import { users } from './users.js';

/**
 * A member's audit trail. Insert-only by convention and by grant (see
 * migrations/0001_policies.sql — the app role has no UPDATE/DELETE privilege on this table),
 * one step lighter than emission_records/claims_ledger's trigger-enforced append-only, since
 * nothing here needs tamper-evidence, only tamper-resistance against the application layer.
 * Row-level security scoped by memberId; a null memberId (a system-level event) is invisible
 * to every tenant-scoped connection by construction.
 */
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').references(() => members.id),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
