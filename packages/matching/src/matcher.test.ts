import { kilograms, kilometres } from '@freyo/shared';
import { describe, expect, it } from 'vitest';
import { findCandidates } from './matcher.js';
import { buildBaseContext, buildBaseMovement, buildBasePosting } from './test-support/fixtures.js';
import type {
  CapacityPostingCandidateInput,
  ConstraintName,
  MovementCandidateInput,
} from './types.js';

describe('findCandidates', () => {
  it('returns nothing when no posting satisfies every constraint', () => {
    const movement = buildBaseMovement();
    const postings = [
      buildBasePosting({ capacityPostingId: 'p1', capacityKg: kilograms(1_000) }), // too small
      buildBasePosting({ capacityPostingId: 'p2', driverHoursRemainingMinutes: 10 }), // no hours
    ];
    expect(findCandidates(movement, postings, buildBaseContext())).toEqual([]);
  });

  it('returns exactly one candidate when exactly one posting qualifies', () => {
    const movement = buildBaseMovement();
    const postings = [
      buildBasePosting({ capacityPostingId: 'p1', capacityKg: kilograms(1_000) }), // fails
      buildBasePosting({ capacityPostingId: 'p2' }), // qualifies
    ];
    const result = findCandidates(movement, postings, buildBaseContext());
    expect(result).toHaveLength(1);
    expect(result[0]?.capacityPostingId).toBe('p2');
  });

  it('returns every qualifying posting when many qualify, in a stable, deterministic order', () => {
    const movement = buildBaseMovement();
    const postings = [
      buildBasePosting({
        capacityPostingId: 'p1',
        plannedDeadheadKm: kilometres(100),
        legDistanceKm: kilometres(100),
      }),
      buildBasePosting({
        capacityPostingId: 'p2',
        plannedDeadheadKm: kilometres(300),
        legDistanceKm: kilometres(300),
      }),
      buildBasePosting({
        capacityPostingId: 'p3',
        plannedDeadheadKm: kilometres(200),
        legDistanceKm: kilometres(200),
      }),
    ];
    const context = buildBaseContext();

    const result = findCandidates(movement, postings, context);
    expect(result.map((c) => c.capacityPostingId)).toEqual(['p2', 'p3', 'p1']); // most CO2e avoided first

    // Same result regardless of input order, and stable across repeated calls.
    const reversed = findCandidates(movement, [...postings].reverse(), context);
    expect(reversed.map((c) => c.capacityPostingId)).toEqual(['p2', 'p3', 'p1']);

    const repeated = findCandidates(movement, postings, context);
    expect(repeated.map((c) => c.capacityPostingId)).toEqual(
      result.map((c) => c.capacityPostingId),
    );
  });

  it('breaks a tie in CO2e avoided by capacityPostingId, for full determinism', () => {
    const movement = buildBaseMovement();
    const postings = [
      buildBasePosting({ capacityPostingId: 'z-posting' }),
      buildBasePosting({ capacityPostingId: 'a-posting' }),
    ];
    const result = findCandidates(movement, postings, buildBaseContext());
    expect(result.map((c) => c.capacityPostingId)).toEqual(['a-posting', 'z-posting']);
  });

  it('every returned candidate carries its full constraint list, all satisfied', () => {
    const result = findCandidates(buildBaseMovement(), [buildBasePosting()], buildBaseContext());
    expect(result[0]?.constraints).toHaveLength(9);
    expect(result[0]?.constraints.every((c) => c.satisfied)).toBe(true);
  });

  describe('a posting violating any single hard constraint never appears', () => {
    const scenarios: {
      readonly constraint: ConstraintName;
      readonly movement?: Partial<MovementCandidateInput>;
      readonly posting?: Partial<CapacityPostingCandidateInput>;
      readonly isVisible?: () => boolean;
    }[] = [
      {
        constraint: 'equipmentType',
        posting: {
          equipment: { vehicleType: 'rigid-12t', temperatureClass: 'ambient', adrClasses: [] },
        },
      },
      {
        constraint: 'temperatureClass',
        movement: {
          equipment: { vehicleType: 'articulated-40t', temperatureClass: 'frozen', adrClasses: [] },
        },
      },
      {
        constraint: 'adrClass',
        movement: {
          equipment: {
            vehicleType: 'articulated-40t',
            temperatureClass: 'ambient',
            adrClasses: ['3'],
          },
        },
      },
      { constraint: 'grossWeight', movement: { grossWeightKg: kilograms(30_000) } },
      { constraint: 'loadingMetres', movement: { loadingMetres: 20 } },
      {
        constraint: 'timeWindow',
        posting: {
          availableWindow: {
            start: new Date('2026-03-05T07:00:00Z'),
            end: new Date('2026-03-05T19:00:00Z'),
          },
        },
      },
      { constraint: 'driverHours', posting: { driverHoursRemainingMinutes: 60 } },
      {
        constraint: 'cabotage',
        movement: { originCountryCode: 'FR', destinationCountryCode: 'FR' },
        posting: { homeCountryCode: 'ES', cabotagePermittedCountryCodes: [] },
      },
      { constraint: 'memberVisibility', isVisible: () => false },
    ];

    it.each(scenarios)(
      'excludes a posting that fails only the $constraint constraint',
      (scenario) => {
        const movement = buildBaseMovement(scenario.movement);
        const posting = buildBasePosting(scenario.posting);
        const context = buildBaseContext(
          scenario.isVisible ? { isVisible: scenario.isVisible } : {},
        );

        const result = findCandidates(movement, [posting], context);
        expect(result).toEqual([]);
      },
    );
  });
});
