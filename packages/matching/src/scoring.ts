import { applyEmissionIntensity, kilometres, transportActivity } from '@freyo/shared';
import { evaluateTimeWindowFeasibility } from './constraints.js';
import type {
  CapacityPostingCandidateInput,
  MatchContext,
  MovementCandidateInput,
  ScoreComponents,
} from './types.js';

/**
 * Every component is named and returned separately — never blended into one ranking number
 * (CLAUDE.md). deadheadKmAvoided and co2eAvoidedGrams reuse packages/shared's unit-safe
 * transportActivity/applyEmissionIntensity — the same mass x distance x intensity formula
 * packages/emissions uses — rather than reimplementing it, since it's exactly the right tool
 * here: this is genuine loaded transport activity (the movement's real mass), not the
 * empty-leg case apps/web's diagnostic had to work around differently.
 */
export function computeScore(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
  context: MatchContext,
): ScoreComponents {
  const deadheadKmAvoided = Math.min(posting.plannedDeadheadKm, posting.legDistanceKm);
  const activity = transportActivity(movement.grossWeightKg, kilometres(deadheadKmAvoided));
  const co2eAvoidedGrams = applyEmissionIntensity(activity, posting.emissionIntensity);

  const { slackMinutes: timeWindowSlackMinutes } = evaluateTimeWindowFeasibility(movement, posting);

  const corridorDensity = context.corridorDensity(
    movement.originSiteId,
    movement.destinationSiteId,
  );
  const historicalAcceptanceRate =
    context.historicalAcceptanceRate(movement.shipperMemberId, posting.carrierMemberId) ?? null;

  return {
    deadheadKmAvoided,
    co2eAvoidedGrams,
    timeWindowSlackMinutes,
    corridorDensity,
    historicalAcceptanceRate,
  };
}
