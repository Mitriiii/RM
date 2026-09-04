import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

export function createDbClient(connectionString: string): Database {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

/**
 * Runs `fn` inside a transaction with the `app.current_member_id` session variable set for
 * its duration, so every row-level-security policy in migrations/0001_policies.sql scopes to
 * `memberId`. This is the only supported way application code should query tenant-owned
 * tables — never query outside a `withTenant` block against a connection that could see
 * another member's rows. Uses `set_config`, not string-interpolated `SET LOCAL`, so the
 * member id always goes through parameter binding.
 */
export async function withTenant<T>(
  db: Database,
  memberId: string,
  fn: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_member_id', ${memberId}, true)`);
    return fn(tx);
  });
}
