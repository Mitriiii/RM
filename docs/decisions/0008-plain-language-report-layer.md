# 0008 — A plain-language layer over the report, without a second source of truth

## Context

The "making Freyo inviting, simple, and market-ready" companion kickoff's Session 6.7
observed a real gap: Session 6.6 made the report screen dense, correct, and fully tested, but
assumed a viewer who already knows what WTT/TTW/WTW mean, already trusts a sortable technical
table as the first thing to read, and already knows a table row is clickable. That's a product
gap, not rigour — CLAUDE.md's "measuring instrument, not a marketing site" rule protects the
credibility of the numbers, it doesn't require that a first-time viewer already speak ISO
14083. This session adds a simple layer on top of the existing technical one, changing nothing
about what data is shown or how it's computed.

## Decisions

**One plain-language headline sentence, computed from the same variables as the technical
summary row — never a second calculation.** `ReportView.tsx` now computes
`totalEmptyKmDisplay`, `totalDieselCostDisplay`, and `totalCO2eKgDisplay` once, and both the
new headline sentence and the existing dense summary row read from those same three values.
There is no second formula anywhere that could quietly drift from the first — `report.ts`'s
`buildDiagnosticReport` remains the only place these totals are computed.
`ReportView.test.tsx`'s "same totals" test renders the fixture and asserts the headline
contains the exact same formatted figures the technical row shows, catching the case where a
future edit touches one without the other. The headline only renders when there's at least one
lane with a probable empty leg — the existing "no probable empty legs found" message already
covers the zero case, so this avoids two competing explanations of the same non-event.

**Technical column terms stay visible; a plain-language label goes in front of them, not in
place of them.** The WTT/TTW/WTW column headers now read "Fuel production (WTT)",
"Combustion (TTW)", and "Total CO2e (WTW)" — the acronym is still there, next to its
plain-language name, both real. Every header and confidence badge with domain vocabulary
also gets an `InfoToggle` (`components/ui/InfoToggle.tsx`): a small inline "i" button that
reveals one real explanatory sentence on click, never a bare tooltip that just expands the
acronym. It renders inline (`display: block` in normal document flow) rather than absolutely
positioned, specifically so it can never get clipped by the lane table's own
`overflow-x-auto` container — it just requires scrolling right to see, the same as any other
wide-table content, which was verified live rather than assumed.

**The confidence-grade explanation is generated from the same exported threshold the grading
logic uses, not restated by hand.** `report.ts`'s `MODELLED_MIN_MOVEMENTS_OBSERVED` constant
(previously module-private) is now exported, and the per-badge `InfoToggle` next to each
`DataQualityBadge` builds its sentence from that constant plus the lane's own
`movementsObserved` — e.g. "based on only 3 observed movements on this lane, below the
5-movement threshold." If that threshold ever changes, this sentence changes with it
automatically; there is no second number to remember to update. (The kickoff's own text named
`emptyLegDetection.ts` as where this threshold lives — it actually lives in `report.ts`, next
to the confidence-grading function it drives; `emptyLegDetection.ts` holds the separate
`MIN_TOTAL_TRIPS_FOR_INFERENCE` threshold for the insufficient-data cutoff. The intent — cite
the real exported constant, never a hand-typed duplicate — is honoured regardless of which
file it lives in.)

**The derivation drill-down gets a visible affordance and a plain-language lead sentence,
with nothing removed.** A chevron icon and a dotted underline on the lane name now signal a
row is clickable, and a "Click a lane to see the full calculation behind its numbers" caption
sits above the table — the interaction was previously discoverable only by hovering. Inside
the expanded panel, one sentence ("This number comes from 5 observed movements on this lane,
routed using {routingEngineVersion}, assuming an articulated truck ran the 1,561 km empty
return leg.") now leads the existing full technical trace — every input, formula, and value
that was already there stays exactly as it was, in full, immediately below.

## Consequences

- Any future addition to `LaneReportRow` or `DiagnosticReport` that has a plain-language
  counterpart should follow the same rule this session establishes: compute the display value
  once, feed both the plain and technical surfaces from it, and add a test asserting they
  match — never let a "simpler" restatement become an independent second source of truth.
- `InfoToggle` is deliberately inline, not a floating/absolutely-positioned popover — if a
  future screen reuses it somewhere without a horizontally-scrolling ancestor, that constraint
  no longer applies and a positioned variant might read better there, but the report table
  should keep the inline version for the clipping reason above.
- `Lede` (a new entry in `components/ui/Typography.tsx`, using the previously-unused
  `subtitle` scale from `tailwind.config.ts`) is now the app's designated component for this
  kind of single plain-language restatement — future screens needing the same pattern should
  reuse it rather than reaching for ad hoc text classes.
