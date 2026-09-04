# CLAUDE.md — Freyo

Persistent context for Claude Code. Read this fully before any work in this repo.

## What we're building

Freyo is a B2B platform for European road freight with two jobs:

1. **Measure** — produce audit-grade, ISO 14083-compliant emissions records for every
   shipment a member company moves.
2. **Reduce** — let member companies pool forward freight flows so empty return legs get
   paired, cutting cost and emissions together.

We are **not** a freight broker. We never buy capacity, take freight liability, quote rates,
or take a percentage of a load. We sell software subscriptions and verified data. If a
proposed feature would put Freyo in the middle of a commercial transaction, stop and flag it
rather than building it.

First market: Spain (Madrid–Zaragoza–Barcelona–Valencia corridors), then Iberia, then
southern France.

## The non-negotiables

These constraints outrank convenience, elegance, and speed. Do not trade them away.

1. **Every emissions calculation is reproducible forever.** Store inputs, factor-set version,
   engine version, and routing engine version with each result. Re-running a 2027 shipment in
   2032 must return the 2027 answer, byte for byte. Never mutate a stored calculation —
   supersede it with a new record that links to the old one.
2. **Never invent an emission factor.** Factors load from a versioned registry populated from
   official sources (EU databases, GLEC Framework, ISO 14083 defaults). If a factor is
   missing, the engine returns an explicit `MissingFactor` error. It never falls back to a
   guess, an average, or a hard-coded literal. A wrong number in an audited report is a
   company-ending event.
3. **Distances are routed road distances.** Never great-circle. Never straight-line
   approximations, not even as a placeholder.
4. **Every result carries a data-quality grade.** Primary (metered fuel, telematics) >
   modelled > default. Surface the grade everywhere the number appears.
5. **Multi-tenant isolation is enforced at the database layer**, via row-level security, not
   only in application code. Member companies may be competitors. A cross-tenant leak is
   existential.
6. **No rate or price data is ever visible between members.** Not in the UI, not in an API
   response, not in a log line, not in an error message. This is a competition-law
   requirement, not a preference.
7. **The claims register is append-only and hash-chained.** No updates, no deletes.
   Corrections are new entries that reference the entry they supersede.
8. **Match explanations are mandatory.** Every proposed pairing must return the constraints
   it satisfied and the components of its score in human-readable form. No opaque ranking.

## Architecture

Monorepo, pnpm workspaces.

```
freyo/
  apps/
    web/                  Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui
    api/                  Fastify, REST + webhooks, OpenAPI-generated types
  packages/
    emissions/            ISO 14083 engine — pure, dependency-light, heavily tested
    matching/             constraint solver + explainable scorer
    factors/              versioned emission factor registry + loaders
    routing/              routing engine client (OSRM/Valhalla), distance cache
    db/                   Drizzle schema, migrations, RLS policies
    shared/               zod schemas, domain types, unit handling
  docs/
    methodology.md        the emissions method, written for an auditor
    decisions/            one ADR per architectural decision
```

**Stack:** TypeScript everywhere. PostgreSQL 16 with PostGIS. Drizzle ORM. Fastify. Next.js
15. Zod at every boundary. Vitest for unit, Playwright for e2e. No ORM magic in the emissions
package — it takes plain objects and returns plain objects.

**Units:** never pass bare numbers between modules. Use branded types (`Kilograms`,
`Kilometres`, `TonneKilometres`, `GramsCO2e`). Unit confusion is the classic failure mode in
emissions software and it is silent.

## The emissions engine — how ISO 14083 actually works

Implement this shape, and read `docs/methodology.md` before changing any of it.

- A **transport chain** decomposes into **transport chain elements** (legs) and **hub
  operations**.
- Each leg belongs to a **transport operation category (TOC)** — a grouping of similar
  operations (vehicle type, fuel, load profile, region).
- A TOC has an **emission intensity**: total well-to-wheel GHG of the TOC divided by its
  total transport activity in tonne-kilometres.
- **Well-to-wheel = well-to-tank (fuel production and distribution) + tank-to-wheel
  (combustion).** Report all three; WTW is the headline.
- A shipment's emissions for a leg = shipment transport activity (mass × routed distance)
  × the TOC emission intensity.
- Report CO₂e including the non-CO₂ gases, and state the GWP set used.

Every intermediate value is stored, not just the final figure. An auditor will ask how you
got from a consignment note to a number, and the system must answer without a human.

## The matcher — deterministic first

Phase 1 is constraint satisfaction plus a transparent weighted score. No machine learning
until there is a year of accept/reject data.

**Hard constraints (candidate must satisfy all):** equipment type compatibility, temperature
class, ADR/dangerous-goods class, gross weight, loading metres/volume, time window overlap
including loading and unloading dwell, driver hours feasibility, cabotage rules for
cross-border legs, member visibility permissions.

**Score components (each returned separately, never as one blended opaque number):**
deadhead kilometres avoided, CO₂e avoided, time-window slack, corridor density, historical
acceptance rate between the two members.

## Working agreements

- **Write the test first for anything in `packages/emissions`.** That package is the product.
  Property-based tests for allocation and unit conversion; golden-file tests for full
  scenarios; a regression test for every bug.
- **One ADR per architectural decision**, in `docs/decisions/NNNN-title.md`. Short: context,
  decision, consequences.
- **Conventional commits.** Small, focused, reviewable.
- **Never commit secrets.** `.env.example` is committed; `.env` never is.
- **Seed data must be realistic**: real Spanish corridors, plausible weights, real equipment
  types. Fake round-number data hides bugs.
- When a requirement is ambiguous, ask rather than guess. Wrong assumptions in this domain
  produce numbers that look fine and are wrong.

## Design direction for the UI

The audience is a logistics manager and a sustainability lead, both of whom live in Excel and
are sceptical of dashboards that look like marketing. Design for that scepticism.

- The interface should feel like a **measuring instrument**, not a marketing site. Dense,
  legible, tabular where tabular is honest. Data should be inspectable down to the inputs.
- Numbers are the hero. Every emissions figure is clickable and opens its full derivation:
  inputs, factors used, factor version, data quality, routed distance.
- Never show a figure without its data-quality grade and its units.
- Avoid the generated-dashboard defaults: identical rounded cards in a grid, a green gradient
  hero, a big number over a small caption, leaf iconography, ALL-CAPS eyebrow labels.
  Sustainability software that looks like sustainability software reads as unserious to this
  audience.
- Pick one or two typefaces deliberately and set a real type scale. Tabular figures for all
  numeric columns so digits align.
- Colour carries meaning only: data-quality grades, over/under baseline, matched/unmatched.
  It is never decoration. Do not use green to mean "good" — it collides with the subject
  matter and misleads.
- Empty states explain what to do next. Errors say what happened and how to fix it.

## Vocabulary — use these words consistently in code, UI, and docs

- **Member** — a company in the network (shipper, carrier group, or 3PL). Never "user" for
  the company.
- **Movement** — one physical transport of goods from A to B.
- **Leg** — one transport chain element within a movement.
- **Capacity posting** — a member declaring a truck available on a route and time window.
- **Pairing** — a proposed or accepted match between a capacity posting and a movement.
- **Record** — an immutable calculated emissions result.
- **Claim** — a registered, ID'd assertion of avoided emissions.

Never use: load board, broker, shipper premium, carbon offset, carbon neutral, green
certificate. These are either the wrong business or legally risky words.

## Out of scope for v1 — do not build these

Live GPS tracking. In-app chat. Payments or invoicing. Driver mobile app. Customs services.
Public carrier ratings or badges. Carbon credit purchase or resale. If asked for one of
these, say it is out of scope and point back to this file.
