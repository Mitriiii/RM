# 0003 — Splitting the routing client from its persistent cache

## Context

CLAUDE.md lists `packages/routing` as owning both "routing engine client (OSRM/Valhalla),
distance cache," and kickoff Session 5 requires the cache to be persistent — it has to
survive a process restart, which an in-process cache cannot do. `packages/db` already owns
every other persistent store in this codebase (emission records, the claims ledger, the
factor-set registry's metadata). Putting real persistence in `packages/routing` directly
would mean either duplicating Postgres/Drizzle plumbing that already exists in
`packages/db`, or having `packages/routing` depend on `packages/db` — which would create a
circular dependency the moment anything in `packages/db` (a seed script, say) wants to call
the routing client to get a real distance instead of a manual estimate, which is exactly the
kind of improvement `packages/db/src/seed.ts`'s own comments call out as a known gap.

## Decision

`packages/routing` owns the client (`createOsrmClient`) and the _interface_ (`DistanceCache`)
plus an in-memory reference implementation (`createInMemoryDistanceCache`) good enough for
tests and for a caller that doesn't need persistence. `packages/db` owns
`PostgresDistanceCache`, the actual persistent implementation, backed by a new
`routing_distance_cache` table — the same split already used for
`ShipmentEmissionRecord` (computed by `packages/emissions`, persisted by `packages/db`).
Dependency direction stays one-way: `packages/db` depends on `packages/routing`'s types,
never the reverse.

`routing_distance_cache` has no row-level security, for the same reason `members` and
`factor_sets` don't: a routed distance between two coordinates is a geographic fact, not one
member's private data, so every member should be able to reuse a distance any other member
already paid an OSRM call for. Coordinates are rounded to 5 decimal places (~1.1m) before
either cache implementation stores or looks one up, via a function
(`roundCoordinate`) exported from `packages/routing` and imported directly by
`packages/db`'s implementation — so the two can never disagree about what counts as "the
same" origin/destination, which would otherwise be an easy place for the two
implementations to drift.

The cache key includes `routingEngineVersion` (CLAUDE.md's explicit requirement), which is
not auto-detected: OSRM's API has no endpoint reporting its own version or the underlying map
data's vintage, so whoever deploys an instance names it, the same way `packages/factors`
requires an explicit factor-set version rather than a "latest" default.

## Consequences

- A future package that wants a real routed distance (the emissions pipeline once it's
  wired end-to-end, the free diagnostic in Session 6, `packages/db`'s own seed script) should
  depend on `@freyo/routing` for the client/cache interface and `@freyo/db` for
  `PostgresDistanceCache`, composing them with `withDistanceCache()` — never write a new
  ad hoc cache.
- The local OSRM setup (`packages/routing/docker/`, `packages/routing/scripts/`) has two
  documented, unresolved gaps: it uses OSRM's bundled `car` profile because no truck profile
  ships with `osrm-backend`, so distances from it are not truck-accurate yet; and it covers
  Spain only, not all of Iberia, because Geofabrik has no single combined Iberia extract.
  Neither blocks the client or cache code, which are profile- and region-agnostic, but
  neither should be forgotten before this is trusted for anything real — see
  `packages/routing/README.md`.
- Docker isn't installed in the environment this was built in, so the docker-compose file
  and prepare script are written against standard, documented OSRM usage but have not been
  run end-to-end. Verify them the first time a real routing engine is needed.
