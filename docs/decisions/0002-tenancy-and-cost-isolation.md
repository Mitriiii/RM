# 0002 — Tenancy, append-only enforcement, and cost isolation in packages/db

## Context

CLAUDE.md's non-negotiables #5–#7 require multi-tenant isolation enforced at the database
layer (not only in application code), emission records that are append-only, a claims ledger
that is append-only and hash-chained, and cost/rate data that is never visible between
members. `packages/db` (kickoff Session 4) has to make all four true at the schema level,
provably — with tests that attempt the forbidden thing and watch it fail.

## Decision

**Two Postgres roles, split by ownership, not by grants alone.** `freyo` (named in
`DATABASE_URL`) runs migrations and owns every table. Postgres table owners bypass their own
row-level security by default, which is necessary for admin tooling and for
`verify_claims_chain()`'s need to see every member's rows — but it also means `freyo` must
never be the role the application or an RLS test connects as, or every policy in
`migrations/0001_policies.sql` is silently inert. `freyo_tenant` (`TENANT_DATABASE_URL`) owns
nothing, has no `BYPASSRLS` attribute, and is the only role that should ever run a real
request. This is the load-bearing fact of the whole design; see `packages/db/README.md`.

**Row-level security via one session variable.** Every tenant-scoped table's policy is
`member_id = current_member_id()`, where `current_member_id()` reads
`current_setting('app.current_member_id', true)`. Application code sets it per-transaction
with `withTenant()` (`src/client.ts`), using `set_config()` — never a string-interpolated
`SET LOCAL` — so the member id always goes through parameter binding. `members` and
`factor_sets` deliberately have no RLS: they're shared reference data the Exchange cannot
function without (a member has to be able to see who else is in the network), and
`capacity_postings` is deliberately readable network-wide but writable only by its owner — a
posting exists to be found. Every other exception to strict per-tenant isolation is
documented at the table it applies to, in `src/schema/*.ts`.

**Append-only via trigger, not grant, for the two tables that need tamper-evidence.**
`emission_records` and `claims_ledger` both get a `BEFORE UPDATE OR DELETE` trigger that
unconditionally raises — this holds even for `freyo`, the table owner, which grants alone
cannot do (an owner has implicit privilege regardless of what's explicitly granted). The
tenant role additionally has no UPDATE/DELETE grant on these two tables at all, so in the
common case the request never even reaches the trigger. `audit_events` gets the lighter
version — no UPDATE/DELETE grant, no trigger — since nothing there needs tamper-evidence
today; see `src/schema/auditEvents.ts` for why that's a deliberate, not accidental, gap.

**`claims_ledger` is one global hash chain, not one per member.** Preventing two members from
claiming the same avoided kilometre requires a single canonical order across the whole
network. The chain-building trigger is `SECURITY DEFINER`, owned by `freyo`, specifically so
its lookup of the chain's current tail sees every member's rows — without that, each tenant's
own RLS view would silently split one global chain into an undetected per-tenant one.
`verify_claims_chain()` is `SECURITY DEFINER` for the same reason: it has to see the whole
ledger to walk it. Hash inputs are joined with a delimiter and timestamps are normalized to
UTC text explicitly (never a bare `timestamptz::text` cast, which depends on the calling
session's `timezone` setting and would produce false tamper positives across sessions in
different zones) — see `claims_ledger_row_signature()` in `migrations/0001_policies.sql`.

A hash chain built this way catches a row whose content was altered without also recomputing
its own hash (the common, sloppy case) at that row directly, and catches a row whose hash
_was_ recomputed to look self-consistent at the next row's now-broken link — both are tested
in `src/claimsLedger.test.ts`. Neither can catch an attacker who rewrites an entire chain
tail consistently; no hash chain can, without an external anchor. That limitation is
documented in the migration, not hidden.

**Cost data lives in its own Postgres schema, `cost`, never `public`.** CLAUDE.md #6 is
explicit that no rate or price is ever visible between members, "not in the UI, not in an API
response, not in a log line, not in an error message." A separate schema means an errant
`SELECT *`, an ORM eager-load, or a debug log of a full row in `public` cannot leak cost data
by accident — nothing outside `cost` can reference it without deliberately qualifying
`cost.movement_costs`. Its row-level security is identical in shape to the rest of the schema
but is the one place a mistake would be worst, so it's called out on its own.

**PostgreSQL 17, not 16.** CLAUDE.md specifies PostgreSQL 16. Homebrew's `postgis` bottle
ships extension files only for PostgreSQL 17 and 18 (`brew info postgis` — verified during
this session), not 16, so a local PostGIS-enabled 16 cluster isn't available via the standard
bottle without a source build. Nothing this schema uses (row-level security, triggers,
`bigserial`, `jsonb`, PostGIS geometry) behaves differently between 16 and 17. Production
should still target whatever version the hosting provider's managed Postgres offers with
PostGIS support — verify at deploy time rather than assuming 16 is available there either.

## Consequences

- Every future table with member-owned rows needs both a migration line
  (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + a policy) and a grant to `freyo_tenant` —
  forgetting either fails safe (no access) rather than open, but forgetting the grant will
  look like a bug, not a security gap, so it should still be caught by a test.
- Any test asserting what a tenant can or cannot see must connect via `createTenantDb()`
  (`freyo_tenant`), never `createAdminDb()` (`freyo`) — a test written against the admin
  connection would pass regardless of whether RLS is even enabled, silently proving nothing.
- `packages/db`'s own test suite runs against a separate `freyo_test` database
  (`vitest.config.ts`'s `test.env`), not the `freyo` database `db:seed` populates — the two
  were sharing one database until this session, and every test run was leaving rows behind in
  what was supposed to be clean seed data.
- drizzle-kit's schema loader does not resolve the `.js`-suffixed relative imports that
  NodeNext module resolution requires in `src/`, so `drizzle.config.ts` points `db:generate`
  at the compiled `dist/schema/index.js` instead — run `pnpm build` before regenerating a
  migration if the schema changed. drizzle-kit also drops the `srid` from a PostGIS geometry
  column's generated DDL (`geometry(point)` instead of `geometry(point, 4326)`); the base
  migration is hand-patched with a comment explaining why.
