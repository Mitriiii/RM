import { gramsCO2e, kilometres } from '@freyo/shared';
import { describe, expect, it } from 'vitest';
import {
  estimateEmptyLegCO2e,
  estimateEmptyLegDieselCostEur,
  ets2CostEur,
  ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE,
} from './costs';

describe('estimateEmptyLegDieselCostEur', () => {
  it('multiplies distance by consumption by price', () => {
    const cost = estimateEmptyLegDieselCostEur(kilometres(100), {
      consumptionLitresPerKm: 0.3,
      priceEurPerLitre: 1.5,
    });
    expect(cost).toBeCloseTo(100 * 0.3 * 1.5, 6);
  });

  it('is zero for zero distance', () => {
    const cost = estimateEmptyLegDieselCostEur(kilometres(0), {
      consumptionLitresPerKm: 0.3,
      priceEurPerLitre: 1.5,
    });
    expect(cost).toBe(0);
  });
});

describe('estimateEmptyLegCO2e', () => {
  it('converts distance x consumption x WTW factor into grams', () => {
    const co2e = estimateEmptyLegCO2e(kilometres(100), 0.3, 3.17);
    // 100km * 0.3 L/km = 30 L; 30 L * 3.17 kgCO2e/L = 95.1 kg = 95,100 g
    expect(co2e).toBeCloseTo(95_100, 0);
  });
});

describe('ets2CostEur', () => {
  it('is zero at a zero carbon price, regardless of CO2e', () => {
    expect(ets2CostEur(gramsCO2e(1_000_000), 0)).toBe(0);
  });

  it('converts grams of CO2e to tonnes before applying the price', () => {
    // 1 tonne = 1,000,000 grams
    const cost = ets2CostEur(gramsCO2e(1_000_000), 50);
    expect(cost).toBeCloseTo(50, 6);
  });

  it('scales linearly with carbon price', () => {
    const co2e = gramsCO2e(2_000_000);
    const at40 = ets2CostEur(co2e, 40);
    const at80 = ets2CostEur(co2e, 80);
    expect(at80).toBeCloseTo(at40 * 2, 6);
  });

  it("the documented default price range includes zero, per the concept doc's own risk mitigation", () => {
    expect(ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE).toContain(0);
  });
});
