import { evaluateConstraints } from './constraints.js';
import { computeScore } from './scoring.js';
import type {
  CapacityPostingCandidateInput,
  MatchCandidate,
  MatchContext,
  MovementCandidateInput,
} from './types.js';

/**
 * Deterministic, stable ordering — not a new blended ranking number. Candidates are sorted by
 * the already-named score components in a fixed, documented priority: CO2e avoided first
 * (Freyo's headline metric), then deadhead km avoided, then capacityPostingId as a final
 * tiebreaker so the order never depends on input array order or on JS's (unspecified for
 * non-numeric-index) object-iteration order. This is an ordering choice over named
 * components, not a computed opaque score — every component that drove the order is still
 * visible on each candidate.
 */
function compareCandidates(a: MatchCandidate, b: MatchCandidate): number {
  if (a.score.co2eAvoidedGrams !== b.score.co2eAvoidedGrams) {
    return b.score.co2eAvoidedGrams - a.score.co2eAvoidedGrams;
  }
  if (a.score.deadheadKmAvoided !== b.score.deadheadKmAvoided) {
    return b.score.deadheadKmAvoided - a.score.deadheadKmAvoided;
  }
  return a.capacityPostingId.localeCompare(b.capacityPostingId);
}

/**
 * Filters a caller-assembled list of capacity-posting candidates down to the ones that
 * satisfy every hard constraint for this movement, each carrying its full constraint
 * explanation and score breakdown. A posting failing even one constraint never appears in
 * the result — there is no partial-credit or "close enough" path. This function does not
 * decide which postings are worth considering in the first place (a geographic/route search)
 * — that candidate generation is the caller's job.
 */
export function findCandidates(
  movement: MovementCandidateInput,
  postings: readonly CapacityPostingCandidateInput[],
  context: MatchContext,
): readonly MatchCandidate[] {
  const candidates: MatchCandidate[] = [];

  for (const posting of postings) {
    const constraints = evaluateConstraints(movement, posting, context.isVisible);
    const allSatisfied = constraints.every((check) => check.satisfied);
    if (!allSatisfied) continue;

    candidates.push({
      movementId: movement.movementId,
      capacityPostingId: posting.capacityPostingId,
      constraints,
      score: computeScore(movement, posting, context),
    });
  }

  return candidates.sort(compareCandidates);
}
