# @freyo/db

Drizzle schema, migrations, and row-level-security policies for PostgreSQL + PostGIS. See
[docs/decisions/0002-tenancy-and-cost-isolation.md](../../docs/decisions/0002-tenancy-and-cost-isolation.md)
for the reasoning behind everything below — this file is the how, that's the why.

## Local setup

Requires PostgreSQL 17+ with PostGIS (CLAUDE.md specifies 16; see the ADR for why this
package targets 17 locally — nothing here is version-specific).

```bash
brew install postgresql@17 postgis
brew services start postgresql@17

createdb freyo
psql -d freyo -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -d postgres -c "CREATE ROLE freyo WITH LOGIN PASSWORD 'freyo';"
psql -d freyo -c "GRANT ALL PRIVILEGES ON DATABASE freyo TO freyo;"
psql -d freyo -c "GRANT ALL ON SCHEMA public TO freyo;"
psql -d postgres -c "ALTER ROLE freyo CREATEROLE;"  # migrations create freyo_tenant

# A second, separate database for the test suite — see "Two databases" below.
createdb freyo_test
psql -d freyo_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -d freyo_test -c "GRANT ALL PRIVILEGES ON DATABASE freyo_test TO freyo;"
psql -d freyo_test -c "GRANT ALL ON SCHEMA public TO freyo;"
```

Copy `.env.example` (repo root) into `packages/db/.env` and fill in `DATABASE_URL` — locally,
`postgresql://freyo:freyo@localhost:5432/freyo`.

```bash
pnpm build          # drizzle-kit reads the compiled schema, not src/ — see the ADR
pnpm db:migrate      # applies migrations/ to $DATABASE_URL
pnpm db:seed         # realistic Spanish corridor data into the freyo database
pnpm test            # runs against freyo_test, not freyo — see below
```

## Two Postgres roles — read this before writing a query or a test

Every table in this package is owned by `freyo`, the role migrations run as. Postgres table
owners bypass their own row-level security by default. That's necessary — `freyo` is what
`verify_claims_chain()` runs as, and admin/seed tooling needs to see everything — but it also
means **`freyo` must never be the role application code or an RLS-sensitive test connects
as**. Doing so wouldn't error; it would silently see every member's data as if row-level
security didn't exist.

`freyo_tenant` (`TENANT_DATABASE_URL`) is the role that's actually subject to every policy in
`migrations/0001_policies.sql`. It owns nothing and has no `BYPASSRLS` attribute.
[`src/client.ts`](./src/client.ts)'s `withTenant()` is the supported way to run a tenant-
scoped query — it wraps a transaction, sets `app.current_member_id` via `set_config()`, and
every table's RLS policy reads that back through `current_member_id()`. Application code
(the Fastify API, once it exists) connects as `freyo_tenant` and always goes through
`withTenant()`; it never touches `DATABASE_URL`/`freyo` directly.

In tests: [`src/test-support/testDb.ts`](./src/test-support/testDb.ts) exports
`createAdminDb()` (→ `freyo`, for fixture setup and admin operations like disabling a
trigger to simulate tampering) and `createTenantDb()` (→ `freyo_tenant`, for every assertion
about what a tenant can or cannot see). A test that asserts isolation using `createAdminDb()`
would pass whether or not RLS is even enabled — it proves nothing.

## Two databases

`packages/db`'s own test suite (`src/*.test.ts`) runs against `freyo_test`, configured in
`vitest.config.ts`'s `test.env` — not `.env`'s `freyo`, which `db:seed` populates. They used
to share one database; every test run left members, movements, and claims behind in what was
supposed to be realistic, inspectable seed data. If you add a new `*.test.ts` file, nothing
extra is needed — the `DATABASE_URL`/`TENANT_DATABASE_URL` override in `vitest.config.ts`
already points every test at `freyo_test`.

## Adding a table

1. Add the `pgTable` definition to `src/schema/`, export it from `src/schema/index.ts`.
2. `pnpm build && pnpm db:generate` — produces a new numbered migration from the schema diff.
3. If the table holds member-owned rows, hand-write a follow-up migration (`drizzle-kit
generate --custom --name=<something>`) that enables RLS, adds its policy, and grants
   `freyo_tenant` the privileges it needs — see `migrations/0001_policies.sql` for the
   pattern. Forgetting this fails safe (`freyo_tenant` sees nothing), but it will look like a
   bug rather than a security hole, so cover it with a cross-tenant test.
4. `pnpm db:migrate` against both `freyo` and `freyo_test` (or `DATABASE_URL=... pnpm
db:migrate` against whichever isn't your default `.env`).
