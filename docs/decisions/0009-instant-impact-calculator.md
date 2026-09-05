# 0009 — The Instant Impact Calculator: populating two empty registries, and which engine it reuses

## Context

The "instant impact calculator" kickoff's Session 6.10 asked for a live, interactive, no-file
front door that computes a real number from typed inputs by reusing the real engine — never a
second, invented one. Building it surfaced two foundational gaps this codebase had carried
since its scaffolding sessions, and one real tension between the kickoff's literal wording and
how the existing, correct engine actually works. All three had to be resolved before any
number on this screen could be real.

## Decisions

**Gap 1 — `packages/factors/data` was empty; nothing in this codebase could produce a real
emission-factor lookup.** `packages/db/src/seed.ts` and every test fixture used a
`TEST_ONLY`-sourced factor set; the registry's own README said so explicitly ("no real factor
set has been added yet"). This meant `packages/emissions`'s audited engine — the one every
non-negotiable in CLAUDE.md is written to protect — had never actually produced a real number
in this codebase. Populated `packages/factors/data/uk-desnz-ghg-conversion-factors/2026-flat-file-v1.2/factors.json`
from the UK Department for Energy Security & Net Zero's "Government GHG Conversion Factors for
Company Reporting 2026" (flat file, version 1.2, updated 2026-07-10) — downloaded directly,
parsed with `openpyxl`, and cross-checked against its own front-page metadata and methodology
report (which confirms IPCC AR5 GWP100 as the basis for these road-freight factors: CH4=28,
N2O=265). Values used: "Freighting goods" → "HGV (non-refrigerated, all diesel)" →
"Average non-refrigerated rigids"/"...artics", "Average laden", giving (per tonne-km):
rigid WTT 43.32 / TTW 199.47 / WTW 242.79 gCO2e; articulated WTT 18.23 / TTW 79.26 / WTW 97.49
gCO2e. This is a first pass, not the registry README's full sign-off procedure (which asks for
independent second-person verification days apart) — flagging that explicitly rather than
silently claiming full compliance.

**This is a UK national default, not a Spain-specific one — used anyway, honestly labeled as
"default" grade.** No free, publicly-fetchable Spain- or EU-specific default table could be
located (GLEC Framework and the ISO 14083 Annex tables are not freely republishable at the
level of detail needed). ISO 14083's own data-quality hierarchy explicitly permits a
recognized-source default value precisely for this situation — a category without
region-specific primary or modelled data — which is exactly what CLAUDE.md's `default` grade
(the lowest, least certain tier) exists to name honestly. The TOC entries still carry
`region: 'ES'` (the operating geography), but every place this factor set is cited says so
plainly. Replacing this with a genuine EU/Spain-sourced default (once one can be properly
verified) should be a priority, not a someday.

**Gap 2 — no corridor had a real cached routed distance anywhere.** `packages/routing`'s
`DistanceCache` interface existed, but nothing had ever populated one for these corridors;
`seed.ts`'s corridor distances were hand-typed estimates, explicitly flagged
`routingSource: 'seed-manual-estimate'`, predating `packages/routing` entirely. Rather than
inventing a distance or skipping this requirement, captured real routed distances from the
same OSRM public-demo engine ADR 0004 already established as legitimate, non-production
real routing (`packages/routing/src/seededCorridors.ts`, captured 2026-09-05, `car` profile —
the public server has no truck profile, the same caveat ADR 0004 already documents). These
seed a real `DistanceCache` (this package's own interface, via `createSeededCorridorCache()`),
not a shortcut lookup table — a caller reading through it is reading through the exact same
abstraction a live routing call would populate.

**Tension — "reuse packages/emissions" cannot literally apply to an empty leg.** The kickoff
asked the calculator to pass "mass/distance/intensity through the same functions in
packages/emissions already used by the real report." But no mass exists for an empty leg by
definition, and `packages/emissions`'s formula (mass × distance × intensity) is exactly zero
whenever mass is zero — this is precisely the problem ADR 0004 already identified and solved,
for the _real_ empty-kilometre diagnostic report, by computing empty-leg CO2e from a
distance/fuel-consumption model instead (`apps/web/src/lib/diagnostic/costs.ts`), not through
`packages/emissions`. Forcing the calculator through `packages/emissions` here would require
inventing a "representative loaded mass" per equipment type that has no real source, which is
its own non-negotiable-#2 problem. Resolution: the calculator reuses the _actual_ real engine
this exact kind of number is computed by in this codebase —
`apps/web/src/lib/diagnostic/costs.ts`'s `estimateEmptyLegEmissions`/
`estimateEmptyLegDieselCostEur`/`ets2CostEur`, imported directly, never reimplemented.
`calculator.test.ts` proves this by calling those functions directly with the calculator's own
derived inputs and asserting byte-identical results — the literal "one engine, not two" test
the kickoff asked for, just naming the correct engine for a mass-independent quantity. The real
registry (`packages/factors`) is still genuinely reused, for the one thing it can honestly
inform here: populating the equipment-type dropdown from `FactorSet.list()` (a new method
added to the `FactorSet` interface for exactly this) rather than a hand-written, driftable
list.

**The diesel price default was already stale — fixed for both screens at once.**
`DEFAULT_DIESEL_PRICE_EUR_PER_LITRE` was €1.55, dated from an earlier session with no capture
date recorded. Real Spain diesel prices in early September 2026 run €1.77–1.87/L across
several trackers. Updated the single shared constant to €1.77/L (GlobalPetrolPrices.com, Spain
average, captured 2026-08-31), with the source and date now also recorded as exported
constants (`DEFAULT_DIESEL_PRICE_SOURCE`, `DEFAULT_DIESEL_PRICE_CAPTURED_ON`) so both the
calculator and the real diagnostic cite the same figure from the same place — never a second,
competing default. A `TODO` comment on the constant itself flags that this needs periodic
revisiting, per the kickoff's own guardrail against a default that silently goes stale
forever.

**Nothing here persists.** `calculateInstantImpact` is a pure function — no I/O, no clock, no
randomness — and `calculator.test.ts` asserts this at the source level (the module's own text
is grepped for any `@freyo/db`, ledger/record-table names, or a fetch/database-client call),
so a future change that quietly adds persistence fails a test immediately rather than being
caught only in review.

## Consequences

- The equipment-type dropdown and the diesel WTT/TTW/carbon-price defaults are shared between
  `/` (the calculator) and `/diagnostic` (the real report) — a future change to any of these
  should update the one shared constant, never fork a second copy for either screen.
- `packages/factors/data`'s real factor set now exists and is genuinely reusable by
  `packages/emissions` for actual loaded-shipment calculations — this was a blocking gap for
  the _entire_ audited pipeline, not just this calculator, and populating it here unblocks
  that pipeline for the first time in this codebase's history. The UK-default/Spain-region
  mismatch flagged above should be resolved with a real EU/Spain source before this factor set
  is used for anything an auditor would actually see.
- `packages/routing/src/seededCorridors.ts` is a small, fixed, hand-maintained list — if more
  corridors are added to the product later, re-run a real routing capture for them the same
  way (never hand-type a plausible-looking distance) and update the captured-on date.
- `FactorSet.list()` is now part of the package's public interface — any future factor set
  implementation must support real enumeration, not just point lookups.
