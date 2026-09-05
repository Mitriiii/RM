import { kilograms } from '@freyo/shared';
import { describe, expect, it } from 'vitest';
import { evaluateConstraints, evaluateTimeWindowFeasibility } from './constraints.js';
import { buildBaseMovement, buildBasePosting } from './test-support/fixtures.js';

const ALWAYS_VISIBLE = () => true;

describe('evaluateConstraints', () => {
  it('reports every constraint satisfied for a comfortably compatible pair', () => {
    const checks = evaluateConstraints(buildBaseMovement(), buildBasePosting(), ALWAYS_VISIBLE);
    expect(checks).toHaveLength(9);
    for (const check of checks) {
      expect(check.satisfied, `${check.constraint}: ${check.explanation}`).toBe(true);
    }
  });

  it('fails equipmentType when vehicle types differ', () => {
    const checks = evaluateConstraints(
      buildBaseMovement(),
      buildBasePosting({
        equipment: { vehicleType: 'rigid-12t', temperatureClass: 'ambient', adrClasses: [] },
      }),
      ALWAYS_VISIBLE,
    );
    const check = checks.find((c) => c.constraint === 'equipmentType');
    expect(check?.satisfied).toBe(false);
  });

  it('allows a frozen vehicle to carry an ambient-only movement', () => {
    const checks = evaluateConstraints(
      buildBaseMovement(),
      buildBasePosting({
        equipment: { vehicleType: 'articulated-40t', temperatureClass: 'frozen', adrClasses: [] },
      }),
      ALWAYS_VISIBLE,
    );
    expect(checks.find((c) => c.constraint === 'temperatureClass')?.satisfied).toBe(true);
  });

  it('does not allow an ambient vehicle to carry a frozen movement', () => {
    const checks = evaluateConstraints(
      buildBaseMovement({
        equipment: { vehicleType: 'articulated-40t', temperatureClass: 'frozen', adrClasses: [] },
      }),
      buildBasePosting(),
      ALWAYS_VISIBLE,
    );
    expect(checks.find((c) => c.constraint === 'temperatureClass')?.satisfied).toBe(false);
  });

  it('fails adrClass when the posting is missing a required class', () => {
    const checks = evaluateConstraints(
      buildBaseMovement({
        equipment: {
          vehicleType: 'articulated-40t',
          temperatureClass: 'ambient',
          adrClasses: ['3'],
        },
      }),
      buildBasePosting(),
      ALWAYS_VISIBLE,
    );
    expect(checks.find((c) => c.constraint === 'adrClass')?.satisfied).toBe(false);
  });

  it('fails grossWeight when the movement exceeds capacity', () => {
    const checks = evaluateConstraints(
      buildBaseMovement({ grossWeightKg: kilograms(30_000) }),
      buildBasePosting(),
      ALWAYS_VISIBLE,
    );
    expect(checks.find((c) => c.constraint === 'grossWeight')?.satisfied).toBe(false);
  });

  it('fails loadingMetres when the movement exceeds capacity', () => {
    const checks = evaluateConstraints(
      buildBaseMovement({ loadingMetres: 20 }),
      buildBasePosting(),
      ALWAYS_VISIBLE,
    );
    expect(checks.find((c) => c.constraint === 'loadingMetres')?.satisfied).toBe(false);
  });

  it('fails driverHours when remaining hours are less than the required drive time', () => {
    const checks = evaluateConstraints(
      buildBaseMovement(),
      buildBasePosting({ driverHoursRemainingMinutes: 60 }),
      ALWAYS_VISIBLE,
    );
    expect(checks.find((c) => c.constraint === 'driverHours')?.satisfied).toBe(false);
  });

  it('fails memberVisibility when the context reports the pair as not visible', () => {
    const checks = evaluateConstraints(buildBaseMovement(), buildBasePosting(), () => false);
    expect(checks.find((c) => c.constraint === 'memberVisibility')?.satisfied).toBe(false);
  });

  describe('cabotage', () => {
    it('is satisfied for a cross-border movement regardless of cabotage permits', () => {
      const checks = evaluateConstraints(
        buildBaseMovement({ originCountryCode: 'ES', destinationCountryCode: 'FR' }),
        buildBasePosting({ cabotagePermittedCountryCodes: [] }),
        ALWAYS_VISIBLE,
      );
      expect(checks.find((c) => c.constraint === 'cabotage')?.satisfied).toBe(true);
    });

    it("is satisfied for a domestic haul within the carrier's own home country", () => {
      const checks = evaluateConstraints(
        buildBaseMovement({ originCountryCode: 'ES', destinationCountryCode: 'ES' }),
        buildBasePosting({ homeCountryCode: 'ES', cabotagePermittedCountryCodes: [] }),
        ALWAYS_VISIBLE,
      );
      expect(checks.find((c) => c.constraint === 'cabotage')?.satisfied).toBe(true);
    });

    it('fails a domestic haul in a foreign country with no declared cabotage allowance', () => {
      const checks = evaluateConstraints(
        buildBaseMovement({ originCountryCode: 'FR', destinationCountryCode: 'FR' }),
        buildBasePosting({ homeCountryCode: 'ES', cabotagePermittedCountryCodes: [] }),
        ALWAYS_VISIBLE,
      );
      expect(checks.find((c) => c.constraint === 'cabotage')?.satisfied).toBe(false);
    });

    it('is satisfied for a domestic haul in a foreign country the carrier has declared allowance in', () => {
      const checks = evaluateConstraints(
        buildBaseMovement({ originCountryCode: 'FR', destinationCountryCode: 'FR' }),
        buildBasePosting({ homeCountryCode: 'ES', cabotagePermittedCountryCodes: ['FR'] }),
        ALWAYS_VISIBLE,
      );
      expect(checks.find((c) => c.constraint === 'cabotage')?.satisfied).toBe(true);
    });
  });
});

describe('evaluateTimeWindowFeasibility', () => {
  it('is satisfied with positive slack when windows comfortably overlap', () => {
    const feasibility = evaluateTimeWindowFeasibility(buildBaseMovement(), buildBasePosting());
    expect(feasibility.satisfied).toBe(true);
    expect(feasibility.slackMinutes).toBeGreaterThan(0);
  });

  it('fails when the posting is available on a completely different day', () => {
    const feasibility = evaluateTimeWindowFeasibility(
      buildBaseMovement(),
      buildBasePosting({
        availableWindow: {
          start: new Date('2026-03-02T07:00:00Z'),
          end: new Date('2026-03-02T19:00:00Z'),
        },
      }),
    );
    expect(feasibility.satisfied).toBe(false);
    expect(feasibility.slackMinutes).toBe(0);
  });

  it("fails when the posting's window is too short to fit loading + driving + unloading", () => {
    const feasibility = evaluateTimeWindowFeasibility(
      buildBaseMovement(),
      buildBasePosting({
        availableWindow: {
          start: new Date('2026-03-01T08:00:00Z'),
          end: new Date('2026-03-01T09:00:00Z'),
        },
      }),
    );
    expect(feasibility.satisfied).toBe(false);
  });

  it('reports slack as the smaller of the load-side and unload-side overlaps', () => {
    // Posting window starts late enough to squeeze the load-side overlap to 90 min
    // ([11:00, 12:30]) while leaving the unload side generous at 270 min ([13:30, 18:00]).
    const feasibility = evaluateTimeWindowFeasibility(
      buildBaseMovement(),
      buildBasePosting({
        availableWindow: {
          start: new Date('2026-03-01T11:00:00Z'),
          end: new Date('2026-03-01T19:00:00Z'),
        },
      }),
    );
    expect(feasibility.satisfied).toBe(true);
    expect(feasibility.slackMinutes).toBeCloseTo(90, 0);
  });
});
