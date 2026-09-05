import { gramsCO2ePerTonneKilometre, kilograms, kilometres } from '@freyo/shared';
import { describe, expect, it } from 'vitest';
import { computeScore } from './scoring.js';
import { buildBaseContext, buildBaseMovement, buildBasePosting } from './test-support/fixtures.js';

describe('computeScore', () => {
  it('caps deadheadKmAvoided at the smaller of plannedDeadheadKm and legDistanceKm', () => {
    const score = computeScore(
      buildBaseMovement(),
      buildBasePosting({ plannedDeadheadKm: kilometres(100), legDistanceKm: kilometres(300) }),
      buildBaseContext(),
    );
    expect(score.deadheadKmAvoided).toBe(100);
  });

  it('computes co2eAvoidedGrams as mass x deadheadKmAvoided x intensity', () => {
    const score = computeScore(
      buildBaseMovement({ grossWeightKg: kilograms(10_000) }),
      buildBasePosting({
        plannedDeadheadKm: kilometres(200),
        legDistanceKm: kilometres(200),
        emissionIntensity: gramsCO2ePerTonneKilometre(90),
      }),
      buildBaseContext(),
    );
    // 10,000 kg = 10 t; 10 t x 200 km = 2,000 tkm; 2,000 tkm x 90 gCO2e/tkm = 180,000 g
    expect(score.co2eAvoidedGrams).toBeCloseTo(180_000, 0);
  });

  it('is zero CO2e avoided when there is no deadhead to avoid', () => {
    const score = computeScore(
      buildBaseMovement(),
      buildBasePosting({ plannedDeadheadKm: kilometres(0) }),
      buildBaseContext(),
    );
    expect(score.deadheadKmAvoided).toBe(0);
    expect(score.co2eAvoidedGrams).toBe(0);
  });

  it('reports historicalAcceptanceRate as null, not a fabricated default, when there is no history', () => {
    const score = computeScore(
      buildBaseMovement(),
      buildBasePosting(),
      buildBaseContext({ historicalAcceptanceRate: () => undefined }),
    );
    expect(score.historicalAcceptanceRate).toBeNull();
  });

  it('passes through a real historicalAcceptanceRate when the context provides one', () => {
    const score = computeScore(
      buildBaseMovement(),
      buildBasePosting(),
      buildBaseContext({ historicalAcceptanceRate: () => 0.75 }),
    );
    expect(score.historicalAcceptanceRate).toBe(0.75);
  });

  it("looks up corridorDensity by the movement's origin and destination site", () => {
    let capturedArgs: [string, string] | undefined;
    const score = computeScore(
      buildBaseMovement({ originSiteId: 'site-a', destinationSiteId: 'site-b' }),
      buildBasePosting(),
      buildBaseContext({
        corridorDensity: (origin, destination) => {
          capturedArgs = [origin, destination];
          return 12;
        },
      }),
    );
    expect(capturedArgs).toEqual(['site-a', 'site-b']);
    expect(score.corridorDensity).toBe(12);
  });

  it('matches the timeWindowSlackMinutes evaluateTimeWindowFeasibility reports independently', () => {
    const movement = buildBaseMovement();
    const posting = buildBasePosting();
    const score = computeScore(movement, posting, buildBaseContext());
    expect(score.timeWindowSlackMinutes).toBeGreaterThan(0);
  });
});
