import { createDbClient, type Database } from '@freyo/db';

let cachedDb: Database | undefined;

/**
 * Always the `freyo_tenant` role, never the admin/migration one — every capacity-posting,
 * pairing, or visibility-block query in this app must go through packages/db's `withTenant`
 * with this connection, or row-level security is silently inert (see packages/db/README.md).
 */
export function getDb(): Database {
  const url = process.env['TENANT_DATABASE_URL'];
  if (!url) {
    throw new Error('TENANT_DATABASE_URL is not configured — see .env.example');
  }
  cachedDb ??= createDbClient(url);
  return cachedDb;
}
