# Freyo emissions methodology

This document explains how Freyo calculates a shipment's transport emissions, for a reader
who knows EN ISO 14083:2023 but not this codebase. It states every assumption and allocation
rule the engine makes. Where the code and this document disagree, the code is a bug — file
it against `packages/emissions`.

## Scope of this version

This document covers `packages/emissions` as it exists after kickoff Session 3: the
per-leg calculation and cross-leg chain summation. It does **not** yet cover:

- **Hub operations.** ISO 14083 treats a transport chain as legs plus hub operations
  (cross-docking, warehousing, terminal handling). CLAUDE.md's architecture describes both.
  This version calculates legs only. No hub-operation emission factor or allocation
  methodology has been sourced and verified yet (see `packages/factors/data/README.md`), so
  none is implemented — a transport chain's total in this version is leg emissions only, and
  should not be presented as a complete door-to-door figure until hub operations are added.
- **Real emission factors.** `packages/factors/data` is currently empty; every number in
  this codebase's tests is a fictional `TEST_ONLY` value, never real GLEC/EU/ISO data. No
  calculation performed with this codebase today should be treated as audit-grade until a
  verified factor set (per that README's checklist) is loaded and referenced.
- **Persistence and reproducibility storage.** This package is pure — no I/O, no database.
  The non-negotiable that a stored calculation is never mutated, only superseded, is enforced
  by `packages/db` (kickoff Session 4), not here. This package only guarantees that calling
  it twice with identical arguments produces identical output.

## The model

A **transport chain** is one shipment's door-to-door movement. It decomposes into one or more
**transport chain elements** — this codebase calls each one a **leg** (`LegInput`). A leg is
one vehicle movement: it has a routed distance, and it belongs to one **transport operation
category** (TOC) — a grouping by vehicle type, fuel, load profile, and region (e.g. a rigid
12-tonne diesel truck running an average load in Spain).

A TOC has an **emission intensity**: grams of CO₂e per tonne-kilometre, in three components —
well-to-tank (fuel production and distribution), tank-to-wheel (combustion), and well-to-wheel
(the sum of the two, and the headline figure). Emission intensities live in a
**factor set** (`packages/factors`), identified by `(source, version, effectiveDate)` and
looked up explicitly — there is no "latest," so a calculation can always be traced to the
exact published table it used.

## The leg calculation

A leg may be carrying more than one shipment's cargo at once — this is the pooled-backhaul
case CLAUDE.md's Exchange is built around, where two members' shipments share one truck.
`calculateLegEmissions` takes a leg and the list of shipments on it, and does two things:

**1. Computes the leg's total emissions.**

```
activity (tonne-km)   = total mass on the leg (tonnes) × leg distance (km)
leg wellToTank (gCO2e) = activity × TOC.wellToTank intensity
leg tankToWheel (gCO2e) = activity × TOC.tankToWheel intensity
leg wellToWheel (gCO2e) = activity × TOC.wellToWheel intensity
```

This is CLAUDE.md's core formula: shipment transport activity (mass × routed distance) times
the TOC's emission intensity, applied once per WTT/TTW/WTW component.

**2. Allocates the leg total to each shipment, by mass share.**

```
shipment's allocation share = shipment's mass / leg's total mass
shipment's wellToWheel      = leg wellToWheel × allocation share
```

(and the same for wellToTank and tankToWheel). **Mass-based allocation is this version's only
allocation driver.** ISO 14083 and the GLEC Framework permit other drivers (volume, loading
metres) when mass is not the binding constraint for a shipment's share of the vehicle; this
codebase does not yet support choosing a different driver. If a shipment's true resource
consumption on a leg is volume-bound rather than mass-bound (e.g. light, bulky cargo), mass
allocation will understate its share. This is a stated limitation, not a hidden one.

Because each shipment's share is `mass_i / total_mass`, and shares sum to 1 by construction,
the allocated amounts always sum back to the leg total (within floating-point tolerance) —
this is enforced by a property-based test in `packages/emissions/src/emissions.test.ts`.

## Missing factors

If the leg's TOC has no entry in the given factor set, `calculateLegEmissions` returns a
typed `MissingFactorError` (from `packages/factors`) and no numeric result at all — there is
no code path that substitutes a guess, an average across other TOCs, or a hard-coded literal.
This is CLAUDE.md's non-negotiable #2, enforced structurally: the function's return type is a
union of "a result" or "a named error," with nothing in between.

## Chain summation

`summarizeTransportChain` sums one shipment's already-allocated records across every leg of
its journey. It rejects records belonging to a different shipment, since silently mixing
shipments would misattribute someone else's emissions.

## What every result carries

Per CLAUDE.md's reproducibility non-negotiable, every `ShipmentEmissionRecord` stores:

- the leg inputs used (TOC, distance, routing source, data-quality grade)
- the shipment's mass, the leg's total mass, and the resulting allocation share
- the exact `FactorSetId` (source, version, effective date) and the GWP set it uses
- the engine version (`EMISSIONS_ENGINE_VERSION`) that produced the record
- the data-quality grade: **primary** (metered fuel, telematics) > **modelled** > **default**.
  This package never assigns a grade itself — the caller knows where its mass, distance, and
  TOC assignment came from, and passes the grade in.

Re-running `calculateLegEmissions` with the same arguments against the same factor set always
returns the same numbers — the function is pure, with no I/O, database access, network calls,
or clock reads. Reproducing a stored 2027 calculation in 2032 means storing these same
arguments and calling the same (or a pinned) `EMISSIONS_ENGINE_VERSION`.

## Worked example

From `packages/emissions/src/__fixtures__/golden/madrid-valencia-shared-leg.json` (fictional
`TEST_ONLY` factors): an articulated 40-tonne diesel truck runs Madrid → Valencia, 357 km,
carrying two shipments — 12,000 kg and 8,000 kg (20,000 kg total).

```
activity = 20 t × 357 km = 7,140 tonne-km
leg wellToWheel = 7,140 × 90 gCO2e/tkm = 642,600 gCO2e

shipment X share = 12,000 / 20,000 = 0.6 -> 642,600 × 0.6 = 385,560 gCO2e
shipment Y share =  8,000 / 20,000 = 0.4 -> 642,600 × 0.4 = 257,040 gCO2e

385,560 + 257,040 = 642,600 -- allocated shares sum back to the leg total
```
