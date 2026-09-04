import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@freyo/db',
    environment: 'node',
    testTimeout: 15_000,
    // Deliberately not packages/db/.env (which points at the `freyo` dev/seed database) —
    // tests run against their own `freyo_test` database (see README.md) so a test run never
    // leaves rows behind in the database `db:seed` populates.
    env: {
      DATABASE_URL: 'postgresql://freyo:freyo@localhost:5432/freyo_test',
      TENANT_DATABASE_URL: 'postgresql://freyo_tenant:freyo_tenant@localhost:5432/freyo_test',
    },
  },
});
