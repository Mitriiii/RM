import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  InvalidUnitValueError,
  applyEmissionIntensity,
  gramsCO2e,
  gramsCO2eToKilogramsCO2e,
  gramsCO2ePerTonneKilometre,
  kilograms,
  kilogramsCO2eToGramsCO2e,
  kilogramsToTonnes,
  kilometres,
  kilometresToMetres,
  metresToKilometres,
  tonneKilometres,
  tonnesToKilograms,
  transportActivity,
} from './units.js';

const nonNegativeFinite = fc.double({ min: 0, max: 1e9, noNaN: true, noDefaultInfinity: true });

describe('unit constructors', () => {
  it.each([
    ['kilograms', kilograms],
    ['kilometres', kilometres],
    ['tonneKilometres', tonneKilometres],
    ['gramsCO2e', gramsCO2e],
    ['gramsCO2ePerTonneKilometre', gramsCO2ePerTonneKilometre],
  ] as const)('%s accepts any finite non-negative number', (_name, factory) => {
    fc.assert(
      fc.property(nonNegativeFinite, (value) => {
        expect(factory(value)).toBe(value);
      }),
    );
  });

  it.each([
    ['kilograms', kilograms],
    ['kilometres', kilometres],
    ['tonneKilometres', tonneKilometres],
    ['gramsCO2e', gramsCO2e],
    ['gramsCO2ePerTonneKilometre', gramsCO2ePerTonneKilometre],
  ] as const)('%s rejects negative numbers', (_name, factory) => {
    fc.assert(
      fc.property(fc.double({ min: -1e9, max: -Number.EPSILON, noNaN: true }), (value) => {
        expect(() => factory(value)).toThrow(InvalidUnitValueError);
      }),
    );
  });

  it.each([
    ['kilograms', kilograms],
    ['kilometres', kilometres],
    ['tonneKilometres', tonneKilometres],
    ['gramsCO2e', gramsCO2e],
    ['gramsCO2ePerTonneKilometre', gramsCO2ePerTonneKilometre],
  ] as const)('%s rejects NaN and Infinity', (_name, factory) => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => factory(value)).toThrow(InvalidUnitValueError);
    }
  });
});

describe('conversion round-trips', () => {
  it('kilograms <-> tonnes round-trips within floating-point tolerance', () => {
    fc.assert(
      fc.property(nonNegativeFinite, (value) => {
        const kg = kilograms(value);
        const roundTripped = tonnesToKilograms(kilogramsToTonnes(kg));
        expect(roundTripped).toBeCloseTo(kg, 6);
      }),
    );
  });

  it('kilometres <-> metres round-trips within floating-point tolerance', () => {
    fc.assert(
      fc.property(nonNegativeFinite, (value) => {
        const km = kilometres(value);
        const roundTripped = metresToKilometres(kilometresToMetres(km));
        expect(roundTripped).toBeCloseTo(km, 6);
      }),
    );
  });

  it('gramsCO2e <-> kilogramsCO2e round-trips within floating-point tolerance', () => {
    fc.assert(
      fc.property(nonNegativeFinite, (value) => {
        const g = gramsCO2e(value);
        const roundTripped = kilogramsCO2eToGramsCO2e(gramsCO2eToKilogramsCO2e(g));
        expect(roundTripped).toBeCloseTo(g, 6);
      }),
    );
  });
});

describe('transportActivity', () => {
  it('is zero whenever mass or distance is zero', () => {
    fc.assert(
      fc.property(nonNegativeFinite, (value) => {
        expect(transportActivity(kilograms(0), kilometres(value))).toBe(0);
        expect(transportActivity(kilograms(value), kilometres(0))).toBe(0);
      }),
    );
  });

  it('scales linearly with mass', () => {
    fc.assert(
      fc.property(
        nonNegativeFinite,
        nonNegativeFinite,
        fc.double({ min: 0, max: 100, noNaN: true }),
        (mass, distance, factor) => {
          const base = transportActivity(kilograms(mass), kilometres(distance));
          const scaled = transportActivity(kilograms(mass * factor), kilometres(distance));
          expect(scaled).toBeCloseTo(base * factor, 6);
        },
      ),
    );
  });

  it('matches the direct mass(tonnes) x distance(km) formula', () => {
    fc.assert(
      fc.property(nonNegativeFinite, nonNegativeFinite, (massKg, distanceKm) => {
        const activity = transportActivity(kilograms(massKg), kilometres(distanceKm));
        expect(activity).toBeCloseTo((massKg / 1_000) * distanceKm, 6);
      }),
    );
  });
});

describe('applyEmissionIntensity', () => {
  it('is zero whenever activity or intensity is zero', () => {
    fc.assert(
      fc.property(nonNegativeFinite, (value) => {
        expect(applyEmissionIntensity(tonneKilometres(0), gramsCO2ePerTonneKilometre(value))).toBe(
          0,
        );
        expect(applyEmissionIntensity(tonneKilometres(value), gramsCO2ePerTonneKilometre(0))).toBe(
          0,
        );
      }),
    );
  });

  it('scales linearly with activity', () => {
    fc.assert(
      fc.property(
        nonNegativeFinite,
        nonNegativeFinite,
        fc.double({ min: 0, max: 100, noNaN: true }),
        (activity, intensity, factor) => {
          const base = applyEmissionIntensity(
            tonneKilometres(activity),
            gramsCO2ePerTonneKilometre(intensity),
          );
          const scaled = applyEmissionIntensity(
            tonneKilometres(activity * factor),
            gramsCO2ePerTonneKilometre(intensity),
          );
          expect(scaled).toBeCloseTo(base * factor, 6);
        },
      ),
    );
  });

  it('matches the direct activity x intensity formula', () => {
    fc.assert(
      fc.property(nonNegativeFinite, nonNegativeFinite, (activity, intensity) => {
        const result = applyEmissionIntensity(
          tonneKilometres(activity),
          gramsCO2ePerTonneKilometre(intensity),
        );
        expect(result).toBeCloseTo(activity * intensity, 6);
      }),
    );
  });
});
