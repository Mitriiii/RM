import { kilometres } from '@freyo/shared';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM,
  estimateEmptyLegDieselCostEur,
  estimateEmptyLegEmissions,
  ets2CostEur,
} from '@/lib/diagnostic/costs';
import {
  MAX_ROUND_TRIPS_PER_MONTH,
  MIN_ROUND_TRIPS_PER_MONTH,
  calculateInstantImpact,
  isValidRoundTripsPerMonth,
  type CalculatorInputs,
} from './calculator';

const MADRID_ZARAGOZA: CalculatorInputs['corridor'] = {
  id: 'madrid-zaragoza',
  cityAName: 'Madrid',
  cityBName: 'Zaragoza',
  distanceKm: 312.1777,
};

const BASE_INPUTS: CalculatorInputs = {
  corridor: MADRID_ZARAGOZA,
  vehicleCategory: 'articulated',
  roundTripsPerMonth: 20,
  emptyRunningRatePercent: 24,
  dieselPriceEurPerLitre: 1.77,
  dieselWttKgCO2ePerLitre: 0.49,
  dieselTtwKgCO2ePerLitre: 2.68,
  carbonPricesEurPerTonne: [0, 45, 50, 63],
};

describe('calculateInstantImpact', () => {
  it('derives estimated empty km from round trips, corridor distance, and the empty-running rate', () => {
    const result = calculateInstantImpact(BASE_INPUTS);
    // 312.1777 km one-way x 2 (round trip) x 20 trips x 24% empty-running rate.
    const expectedEmptyKm = 312.1777 * 2 * 20 * 0.24;
    expect(result.estimatedEmptyKmPerMonth).toBeCloseTo(expectedEmptyKm, 6);
    expect(result.estimatedEmptyTripsPerMonth).toBeCloseTo(20 * 0.24, 6);
  });

  it('never computes its own CO2e or diesel-cost math — it is byte-identical to calling the real diagnostic report engine (apps/web/src/lib/diagnostic/costs.ts) directly with the same derived inputs', () => {
    const result = calculateInstantImpact(BASE_INPUTS);

    const consumptionLitresPerKm =
      DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM[BASE_INPUTS.vehicleCategory];
    const distance = kilometres(result.estimatedEmptyKmPerMonth);

    const expectedDieselCost = estimateEmptyLegDieselCostEur(distance, {
      consumptionLitresPerKm,
      priceEurPerLitre: BASE_INPUTS.dieselPriceEurPerLitre,
    });
    const expectedEmissions = estimateEmptyLegEmissions(
      distance,
      consumptionLitresPerKm,
      BASE_INPUTS.dieselWttKgCO2ePerLitre,
      BASE_INPUTS.dieselTtwKgCO2ePerLitre,
    );

    // Not "close to" — the exact same numbers, because it is the exact same function call.
    expect(result.dieselCostEurPerMonth).toBe(expectedDieselCost);
    expect(result.wellToTankGrams).toBe(expectedEmissions.wellToTankGrams);
    expect(result.tankToWheelGrams).toBe(expectedEmissions.tankToWheelGrams);
    expect(result.wellToWheelGrams).toBe(expectedEmissions.wellToWheelGrams);

    for (const scenario of result.ets2Scenarios) {
      const expectedCost = ets2CostEur(
        expectedEmissions.wellToWheelGrams,
        scenario.carbonPriceEurPerTonne,
      );
      expect(scenario.costEur).toBe(expectedCost);
    }
  });

  it('produces the same WTW as WTT + TTW, exactly like the real report', () => {
    const result = calculateInstantImpact(BASE_INPUTS);
    expect(result.wellToWheelGrams).toBeCloseTo(
      result.wellToTankGrams + result.tankToWheelGrams,
      6,
    );
  });

  it('scales linearly with round trips per month, holding everything else fixed', () => {
    const oneTrip = calculateInstantImpact({ ...BASE_INPUTS, roundTripsPerMonth: 1 });
    const tenTrips = calculateInstantImpact({ ...BASE_INPUTS, roundTripsPerMonth: 10 });
    expect(tenTrips.estimatedEmptyKmPerMonth).toBeCloseTo(oneTrip.estimatedEmptyKmPerMonth * 10, 6);
    expect(tenTrips.wellToWheelGrams).toBeCloseTo(oneTrip.wellToWheelGrams * 10, 6);
  });

  it('produces a different, still-correct number for a different equipment category (rigid vs articulated consumption)', () => {
    const articulated = calculateInstantImpact(BASE_INPUTS);
    const rigid = calculateInstantImpact({ ...BASE_INPUTS, vehicleCategory: 'rigid' });
    expect(rigid.wellToWheelGrams).not.toBe(articulated.wellToWheelGrams);
    // Articulated trucks are modelled with higher unladen consumption per km than rigid ones
    // in DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM (0.33 vs 0.24 L/km), so more CO2e for the
    // same empty km.
    expect(articulated.wellToWheelGrams).toBeGreaterThan(rigid.wellToWheelGrams);
  });
});

describe('isValidRoundTripsPerMonth', () => {
  it('accepts values within the documented bounds', () => {
    expect(isValidRoundTripsPerMonth(MIN_ROUND_TRIPS_PER_MONTH)).toBe(true);
    expect(isValidRoundTripsPerMonth(MAX_ROUND_TRIPS_PER_MONTH)).toBe(true);
    expect(isValidRoundTripsPerMonth(50)).toBe(true);
  });

  it('rejects values outside the documented bounds, non-finite values, and NaN', () => {
    expect(isValidRoundTripsPerMonth(0)).toBe(false);
    expect(isValidRoundTripsPerMonth(MAX_ROUND_TRIPS_PER_MONTH + 1)).toBe(false);
    expect(isValidRoundTripsPerMonth(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidRoundTripsPerMonth(Number.NaN)).toBe(false);
  });
});

describe('nothing here touches persistence', () => {
  it('this module imports no database client, no ORM, and no claims-ledger or emission-records schema', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./calculator.ts', import.meta.url), 'utf-8'),
    );
    // A deliberately loud, easy-to-grep assertion: if a future change makes this module import
    // @freyo/db or any persistence client, this test fails immediately. The calculator is a
    // pure, client-facing estimate — see CLAUDE.md and the "instant impact calculator"
    // kickoff's guardrail against ever writing an emission_record or claims_ledger entry.
    expect(source).not.toMatch(/@freyo\/db/);
    expect(source).not.toMatch(/claims_ledger|claimsLedger|emission_records|emissionRecords/);
    expect(source).not.toMatch(/\bfetch\(|\bdrizzle\(|\bpostgres\(/);
  });
});
