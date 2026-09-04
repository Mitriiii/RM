import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Database } from '../client.js';
import * as schema from '../schema/index.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set for packages/db tests — see packages/db/.env`);
  }
  return value;
}

export interface TestConnection {
  readonly db: Database;
  close(): Promise<void>;
}

/**
 * Connects as the migration/owner role. Bypasses row-level security by default (table
 * owner), so tests use this only for fixture setup and for admin operations like disabling
 * the append-only trigger to simulate tampering — never for assertions about what a
 * tenant-scoped connection can see.
 */
export function createAdminDb(): TestConnection {
  const client = postgres(requireEnv('DATABASE_URL'));
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

/**
 * Connects as `freyo_tenant`, which owns nothing and has no BYPASSRLS attribute — every
 * policy in migrations/0001_policies.sql actually applies. This is the connection RLS
 * assertions run against.
 */
export function createTenantDb(): TestConnection {
  const client = postgres(requireEnv('TENANT_DATABASE_URL'));
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
