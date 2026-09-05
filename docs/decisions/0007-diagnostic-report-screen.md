# 0007 — The diagnostic report screen: WTT/TTW split, confidence grading, and its own test layer

## Context

The "make Freyo market-ready" companion kickoff's Session 6.6 asked for the report screen —
the actual payoff of the diagnostic built in Session 6 and redesigned in Session 6.5 — to
become a dense, auditor-usable instrument rather than a plain results dump: separate
well-to-tank/tank-to-wheel/well-to-wheel figures per CLAUDE.md's reporting requirement, a
per-row data-quality signal, an honest statistical floor below which no empty leg is inferred,
and a render-level regression test the way `packages/emissions` already has for its own logic.

## Decisions

**Well-to-wheel is derived, never a third adjustable input.** `costs.ts` previously exposed a
single `DEFAULT_DIESEL_WTW_KG_CO2E_PER_LITRE` constant. CLAUDE.md requires WTT + TTW reported
separately with WTW as the headline sum, not an independently sourced number, so the diagnostic
now takes separate `dieselWttKgCO2ePerLitre` / `dieselTtwKgCO2ePerLitre` inputs and
`estimateEmptyLegEmissions` always computes `wellToWheelGrams = wellToTankGrams +
tankToWheelGrams`. There is no code path that lets WTW drift from that sum — the UI's
assumptions step states this explicitly rather than leaving it implicit.

**A lane needs at least two recorded movements before an empty leg is inferred.** A single
shipment on a city pair carries no directional signal — the lane-imbalance heuristic
(ADR 0004) needs at least a there-and-(not-back) pattern to say anything. `MIN_TOTAL_TRIPS_FOR_INFERENCE
= 2` in `emptyLegDetection.ts` gates this; lanes below it are routed as `InsufficientDataLane`
entries — not silently included in the main table (which would overstate confidence) and not
silently dropped (which would hide that the file contains lanes the diagnostic couldn't use).

**Per-row "confidence" reuses the existing data-quality vocabulary, restricted to what this
diagnostic can honestly claim.** Nothing in this diagnostic is measured, so `primary` is never
used. A lane crosses from `default` to `modelled` at 5 or more observed movements
(`MODELLED_MIN_MOVEMENTS_OBSERVED`) — an arbitrary but stated threshold, chosen as "enough
repeated observations that the imbalance looks like a pattern rather than a coincidence of
scheduling," not derived from any statistical test. This is a judgement call, not a citation;
a future version with real acceptance/rejection data could replace it with a confidence
interval.

**€45/tCO2e is cited as the named ETS2 price-containment anchor, not silently made the
default.** The market brief names ETS2's price-containment mechanism (extra allowances release
above ~€45/tCO2e, 2020-adjusted, in its first two years) as "the closest thing to an official
anchor price this market has." `ETS2_PRICE_CONTAINMENT_ANCHOR_EUR_PER_TONNE` is exported and
used to compute one prominent on-screen exposure sentence, but the guardrail against
hard-coding a single carbon price still holds: the adjustable scenario table
(`ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE = [0, 45, 50, 63]`) remains the source of truth, the
anchor is one labeled row within it, and users can add arbitrary custom prices. The 1 January
2028 date is stated inline next to the citation, not left to a tooltip or a stale "2027"
carried over from an earlier draft.

**The report screen gets its own render-level test, separate from the data-pipeline test.**
`report.test.ts` already covered `buildDiagnosticReport`'s logic; nothing exercised
`ReportView.tsx` actually rendering that data correctly. `ReportView.test.tsx` uses
`@testing-library/react` against a hand-built `DiagnosticReport` fixture and asserts on
rendered screen text — lane figures, the WTT/TTW/WTW split, the insufficient-data and
excluded-row sections, the ETS2 anchor citation, sort interaction, and the empty-state message.
This needed new infrastructure: `vitest.config.ts` routes `*.test.tsx` to a `jsdom` environment
via `environmentMatchGlobs` (pure `lib/diagnostic` logic stays on the faster `node`
environment); `vitest.setup.ts` imports `@testing-library/jest-dom/vitest` and explicitly wires
`afterEach(cleanup)`, since `@testing-library/react`'s own auto-cleanup only registers when it
finds a global `afterEach` at import time and this repo imports test globals explicitly rather
than enabling `test.globals`; and `vitest.config.ts` needed both an explicit `resolve.alias`
for `@/*` (vitest doesn't read the `tsconfig.json` path mapping Next.js resolves at build time)
and `esbuild: { jsx: 'automatic' }` (vitest's default esbuild JSX transform assumes a global
`React`, which nothing in these files imports). `apps/web/tsconfig.json`'s `include` also
needed `vitest.setup.ts` added explicitly — without it, `tsc` typechecks `ReportView.test.tsx`
outside the compilation unit that sees the jest-dom matcher augmentation, and every
`toBeInTheDocument()` call fails to typecheck even though it works at runtime.

## Consequences

- Any future change to `LaneReportRow` or `DiagnosticReport`'s shape should update
  `ReportView.test.tsx`'s fixture alongside `report.test.ts`'s — the two now cover different
  failure modes (wrong data vs. wrong rendering) and neither substitutes for the other.
- The insufficient-data-lanes section and the excluded-rows section are both `print:hidden` —
  they're upload-time diagnostic caveats about what couldn't be analyzed, not report content,
  so a printed/PDF export omits them while keeping the ETS2 disclaimer banner and the scenario
  table itself visible. If an auditor workflow later needs a full accounting of excluded rows
  in the exported PDF, this call should be revisited.
- The `MODELLED_MIN_MOVEMENTS_OBSERVED = 5` threshold and `MIN_TOTAL_TRIPS_FOR_INFERENCE = 2`
  threshold are both stated constants, not tuned against real acceptance data (none exists
  yet) — treat them as provisional and revisit once real member data is available.
