# @freyo/routing

A client for a self-hosted OSRM instance's HTTP API, plus the interface (and an in-memory
reference implementation) for a persistent distance cache. See
[`src/osrmClient.ts`](./src/osrmClient.ts) and [`src/cache.ts`](./src/cache.ts).

## The non-negotiable

Great-circle distance is never used, not even as a fallback (CLAUDE.md). If the routing
engine is unreachable, returns a non-success status, or reports no route, every function
here throws `RoutingUnavailableError` rather than returning an estimate. There is no code
path in this package that computes a straight-line distance.

## Two known, honest gaps in the local OSRM setup below

**No real truck profile.** `docker-compose.yml` and `scripts/prepare-osrm-data.sh` use
OSRM's bundled `car.lua` profile. `osrm-backend` ships `car`, `bike`, and `foot` only — no
official truck/HGV profile exists in the base image. A car profile ignores weight limits,
height restrictions, and hazmat road bans, so **distances from this local setup are not
truck-accurate** and should not be used for anything beyond exercising the client's plumbing
until a real truck Lua profile (respecting those restrictions) is sourced or written and
substituted for `/opt/car.lua` in both files. Track this as its own piece of work — it's a
data problem, not a code change here.

**Spain, not all of Iberia.** Geofabrik doesn't publish a single combined Iberia extract —
Spain and Portugal are separate `.osm.pbf` files. `prepare-osrm-data.sh` downloads Spain
only, which covers CLAUDE.md's first-market corridors (Madrid–Zaragoza–Barcelona–Valencia).
Extending to all of Iberia means downloading `portugal-latest.osm.pbf` too and merging the
two extracts (e.g. with `osmium merge`) before running `osrm-extract` — not yet done here.

## Local setup

Requires Docker (not installed in the environment this package was built in — the
docker-compose file and script below are written against standard, documented OSRM usage but
have not been executed end-to-end here; verify them the first time you run this).

```bash
cd packages/routing
./scripts/prepare-osrm-data.sh   # downloads Spain (~1GB) and prepares OSRM's data files
cd docker && docker compose up   # serves the routing API on http://localhost:5000
```

Then point the client at it:

```ts
import { createOsrmClient, withDistanceCache, createInMemoryDistanceCache } from '@freyo/routing';

const routingEngineVersion = 'osrm-5.27.1-spain-2026.02'; // name it yourself — see below
const client = createOsrmClient({ baseUrl: 'http://localhost:5000', routingEngineVersion });
const cached = withDistanceCache(client, createInMemoryDistanceCache(), routingEngineVersion);
```

(`apps/api`/`packages/db` should use `PostgresDistanceCache` from `@freyo/db` instead of the
in-memory cache — see that package's README.)

## Quicker local dev: OSRM's public demo server

Before setting up Docker, `apps/web/.env.local` points the empty-kilometre diagnostic
(kickoff Session 6) at `https://router.project-osrm.org` — OSRM's own public demo server.
It's real routing, not an estimate, so it's a legitimate way to exercise the full pipeline
without local infrastructure. It is rate-limited, has no uptime guarantee, and only serves
the `car` profile — never point production traffic at it. Use the self-hosted setup above
for anything beyond casual local dev.

## Naming a `routingEngineVersion`

OSRM's HTTP API has no endpoint that reports its own version or the map data's vintage.
`routingEngineVersion` is not auto-detected — whoever deploys an OSRM instance names it,
the same way `packages/factors` requires an explicit factor-set version rather than a
"latest". A reasonable convention: `osrm-<osrm version>-<region>-<extract date>`, e.g.
`osrm-5.27.1-spain-2026.02`. This string is what makes the distance cache safe to keep
across an engine or map-data upgrade — see `DistanceCache`'s doc comment in `src/cache.ts`.

## Environment variables

See `.env.example` at the repo root: `ROUTING_ENGINE_URL`, `ROUTING_ENGINE_VERSION`.
