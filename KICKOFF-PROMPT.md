# Claude Code — kickoff prompts

Paste these one at a time. Wait for each to finish, review the diff, commit, then move on.
Do not paste them all at once; long unsupervised runs produce plausible code that quietly
violates the constraints in `CLAUDE.md`.

---

## Session 0 — before you start

In the repo root, make sure `CLAUDE.md` exists (from this bundle) and `FREYO-Concept-v2.md`
is in `docs/`. Then run `claude` in that directory.

---

## Session 1 — scaffold and rules

```
Read CLAUDE.md and docs/FREYO-Concept-v2.md in full before doing anything.

Set up the monorepo skeleton exactly as described in CLAUDE.md: pnpm workspaces, TypeScript
strict mode, the apps/ and packages/ layout, Vitest, ESLint, Prettier, and a conventional-
commits hook. Do not implement any business logic yet.

Then create packages/shared with the branded unit types (Kilograms, Kilometres,
TonneKilometres, GramsCO2e) and their conversion functions, with property-based tests
proving that conversions round-trip and that mixing units is a compile error.

Finish by writing docs/decisions/0001-monorepo-and-stack.md as an ADR explaining the stack
choice, and show me the tree.
```

## Session 2 — the factor registry

```
Build packages/factors: a versioned emission-factor registry.

Requirements:
- A factor set is immutable and identified by (source, version, effective_date).
- Lookups take an explicit factor-set version. There is no "latest" default anywhere.
- A missing factor returns a typed MissingFactor error. It never falls back to a guess,
  an average, or a hard-coded literal. Enforce this with a test.
- Loaders read from versioned data files. Include the loader and the schema, but leave the
  data files as documented placeholders with a README explaining exactly which official
  sources fill them and how to verify a set before it is marked usable.

Do not invent any numeric factor values. Not even for tests — tests use clearly fictional
factor sets named TEST_ONLY.
```

## Session 3 — the emissions engine

```
Build packages/emissions implementing ISO 14083 as described in CLAUDE.md.

Model: transport chain -> transport chain elements (legs) + hub operations; each leg belongs
to a transport operation category with an emission intensity in gCO2e per tonne-kilometre;
shipment emissions per leg = (mass x routed distance) x intensity, reported as well-to-tank,
tank-to-wheel, and well-to-wheel.

Hard requirements:
- Pure functions. No I/O, no database, no network in this package.
- Every result includes: the inputs it used, the factor-set version, the engine version, the
  routing source, and a data-quality grade (primary / modelled / default).
- Results are immutable value objects.
- Write the tests first. Property-based tests for allocation (the sum of allocated shipment
  emissions across a shared leg equals the leg total, within tolerance) and for unit
  handling. Golden-file tests for three end-to-end scenarios.

Then write docs/methodology.md explaining the method in plain language for an auditor who
knows ISO 14083 but not our codebase. State every assumption and every allocation rule.
```

## Session 4 — data model and tenancy

```
Build packages/db: Drizzle schema and migrations for PostgreSQL 16 with PostGIS.

Core tables: members, users, sites, movements, legs, capacity_postings, pairings,
emission_records, claims_ledger, factor_sets, audit_events.

Requirements:
- Multi-tenant isolation enforced with PostgreSQL row-level security policies, not only in
  application code. Write tests that attempt cross-tenant reads and prove they fail at the
  database layer.
- emission_records are append-only: a correction inserts a new row referencing supersedes_id.
  Enforce with a trigger, not a convention.
- claims_ledger is append-only and hash-chained: each row stores the hash of the previous
  row. Include a verification function that walks the chain and detects tampering, with a
  test that tampering is caught.
- No column anywhere stores a rate, price, or freight cost that could become visible to
  another member. Cost data lives in a separate schema with its own policies.

Seed with realistic Spanish corridor data: Madrid-Zaragoza-Barcelona, Madrid-Valencia,
Valencia-Barcelona. Real distances, plausible weights, real equipment types.
```

## Session 5 — routing

```
Build packages/routing: a client for a self-hosted OSRM or Valhalla instance, returning
routed road distance and duration for truck profiles.

Requirements:
- Great-circle distance is never used, not even as a fallback. If routing is unavailable the
  call fails loudly.
- Persistent distance cache keyed by (origin, destination, profile, routing engine version).
  Cached results record which engine version produced them.
- Include docker-compose for a local OSRM instance with an Iberia extract, and document the
  setup in the README.
```

## Session 6 — the free diagnostic (the wedge)

```
Build the first user-facing flow in apps/web: the empty-kilometre diagnostic.

A prospective member uploads a CSV or Excel of shipment history (origin, destination, date,
weight, equipment type). The system:
1. Validates and maps columns with a preview-and-correct step, since real files are messy.
2. Routes every movement and calculates emissions via packages/emissions.
3. Identifies probable empty return legs from the sequence of movements per vehicle or lane.
4. Produces a report: empty kilometres by lane, the diesel cost of those kilometres, the
   CO2e, and a scenario table showing the added cost under ETS2 at several carbon prices
   the user can set. Do not hard-code a carbon price; it is an input with a documented
   default range and a source note.
5. Exports to PDF.

Follow the design direction in CLAUDE.md. This screen is a measuring instrument, not a
marketing page. Every number opens its derivation. No green gradients, no leaf icons, no
grid of identical rounded cards.
```

## Session 7 — the matcher

```
Build packages/matching: the deterministic constraint solver and explainable scorer described
in CLAUDE.md.

Hard constraints filter candidates; the score is returned as separate named components, never
blended into one opaque number. Every candidate returns a structured explanation of which
constraints it satisfied and how each score component was derived.

No machine learning. Write tests covering: no candidate satisfies constraints; exactly one
does; many do and ordering is stable and deterministic; and that a candidate violating any
single hard constraint never appears.
```

---

## Prompts to reuse constantly

- `Review the last change against the non-negotiables in CLAUDE.md and list every violation.`
- `What did you assume here that I didn't tell you? List assumptions with the risk of each
  being wrong.`
- `Write the failing test first, show it to me, then implement.`
- `Explain this calculation as if to an auditor who will sign off on the number.`

## Things to refuse if Claude Code proposes them

- A hard-coded emission factor "for now"
- Straight-line distance as a placeholder
- Tenant filtering in application code only
- A mutable emissions record
- A single blended match score without components
- Any feature from the out-of-scope list in `CLAUDE.md`
