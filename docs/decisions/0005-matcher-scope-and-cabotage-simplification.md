# 0005 — What packages/matching does and does not model

## Context

Kickoff Session 7 asks for the deterministic constraint solver and explainable scorer from
CLAUDE.md: hard constraints filter candidates, score components are named and separate, no
machine learning, and a candidate violating any single hard constraint must never appear in
the result. Two of CLAUDE.md's nine named hard constraints — driver hours and cabotage — are
real regulatory/operational calculations with enough complexity that implementing them fully
would mean building parts of a routing/scheduling engine and an EU compliance engine inside
what is supposed to be a pure constraint solver. This ADR states where the line was drawn.

## Decisions

**packages/matching takes precomputed inputs; it does not compute distance, duration, or
emission factors itself.** `legDistanceKm`, `requiredDriveDurationMinutes`, and
`emissionIntensity` arrive on the candidate inputs from the caller (`packages/routing`,
`packages/factors`), the same dependency-injection shape `packages/emissions` uses for its
`FactorSet` argument. This package also does not decide _which_ postings are worth
considering for a movement — that geographic/route search is the caller's job; `findCandidates`
filters and scores a list the caller already assembled.

**Driver hours is a single remaining-minutes check, not an EU driving-time-rules engine.**
`checkDriverHours` compares `posting.driverHoursRemainingMinutes` against
`movement.requiredDriveDurationMinutes`. It does not itself compute remaining hours from EU
Regulation 561/2006's daily/weekly driving limits and break rules — that calculation
(wherever `driverHoursRemainingMinutes` comes from) is upstream of this package.

**Cabotage is a precomputed-permission check, not the EU rule itself.** EU Regulation
1072/2009 art. 8 allows a maximum of 3 cabotage operations within 7 days of an inbound
international delivery. `checkCabotage` does not count operations or track a 7-day window —
it checks whether the leg is a domestic haul (same origin/destination country) performed by a
carrier not domiciled there, and if so, whether `cabotagePermittedCountryCodes` (a
caller-maintained list) includes that country. The actual operation-counting logic belongs
wherever that list is produced, not in this pure constraint check — `constraints.ts`'s doc
comment says this explicitly so it isn't mistaken for a complete implementation later.

**Temperature class is a capability ordering, not an exact match.** A frozen vehicle can carry
chilled or ambient cargo; a chilled vehicle can carry ambient; an ambient-only vehicle can
carry neither. `TEMPERATURE_CAPABILITY_RANK` in `constraints.ts` encodes this as
`ambient < chilled < frozen`, and the constraint is satisfied when the posting's rank is at
least the movement's rank — a real, useful relaxation over exact matching that costs nothing
extra to implement correctly.

**The time-window constraint is a feasibility check, not a scheduler.** CLAUDE.md's "time
window overlap including loading and unloading dwell" is implemented as: the posting's
availability must overlap both an effective loading window (pickup window extended by
loading dwell) and an effective unloading window (delivery window pulled earlier by unloading
dwell), and the posting's total availability must be long enough to fit loading + driving +
unloading. It does not place an exact departure time inside the window — that scheduling
decision belongs to whoever accepts the pairing. The same feasibility calculation produces
both the `timeWindow` hard-constraint result and the `timeWindowSlackMinutes` score
component (`evaluateTimeWindowFeasibility` is shared by `constraints.ts` and `scoring.ts`),
so the two can never silently disagree about how much slack there really is.

**Ordering candidates is a documented multi-key sort over named components, not a new blended
score.** `findCandidates` returns qualifying candidates sorted by `co2eAvoidedGrams`
descending, then `deadheadKmAvoided` descending, then `capacityPostingId` ascending as a
final tiebreaker. This is a priority order over the components CLAUDE.md already requires to
be named and visible — every value that drove the order is still on the candidate, unlike an
opaque combined ranking number.

**deadheadKmAvoided and co2eAvoidedGrams reuse `packages/shared`'s
`transportActivity`/`applyEmissionIntensity`**, the same mass × distance × intensity formula
`packages/emissions` uses, rather than reimplementing it. This is the genuine loaded-cargo
case (the movement's real mass moving the deadhead distance it now doesn't have to run
empty), unlike `apps/web`'s empty-kilometre diagnostic, which needed a different, explicitly
separate method because it was estimating an actually-empty leg (see
`docs/decisions/0004-empty-km-diagnostic-scope.md`).

## Consequences

- A caller wiring this package to `packages/db` needs to produce `driverHoursRemainingMinutes`
  and `cabotagePermittedCountryCodes` from real EU driving-time and cabotage-tracking logic
  that doesn't exist yet anywhere in this codebase — this package assumes that data is already
  correct, it does not validate the regulation itself.
- `historicalAcceptanceRate` is `null`, never a fabricated neutral default (like 0.5), when
  `MatchContext.historicalAcceptanceRate` returns `undefined` — a new shipper/carrier
  relationship has no history, and the score breakdown says so rather than implying one.
