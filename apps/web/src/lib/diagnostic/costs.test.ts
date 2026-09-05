import { gramsCO2e, kilometres } from '@freyo/shared';
import { describe, expect, it } from 'vitest';
import {
  estimateEmptyLegDieselCostEur,
  estimateEmptyLegEmissions,
  ets2CostEur,
  ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE,
  ETS2_PRICE_CONTAINMENT_ANCHOR_EUR_PER_TONNE,
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

describe('estimateEmptyLegEmissions', () => {
  it('converts distance x consumption x WTT/TTW factors into grams', () => {
    const emissions = estimateEmptyLegEmissions(kilometres(100), 0.3, 0.49, 2.68);
    // 100km * 0.3 L/km = 30 L
    // WTT: 30 L * 0.49 kgCO2e/L = 14.7 kg = 14,700 g
    // TTW: 30 L * 2.68 kgCO2e/L = 80.4 kg = 80,400 g
    expect(emissions.wellToTankGrams).toBeCloseTo(14_700, 0);
    expect(emissions.tankToWheelGrams).toBeCloseTo(80_400, 0);
  });

  it('well-to-wheel always equals well-to-tank plus tank-to-wheel — never an independent third number', () => {
    const emissions = estimateEmptyLegEmissions(kilometres(325), 0.33, 0.49, 2.68);
    expect(emissions.wellToWheelGrams).toBeCloseTo(
      emissions.wellToTankGrams + emissions.tankToWheelGrams,
      6,
    );
  });

  it('is zero across all three components for zero distance', () => {
    const emissions = estimateEmptyLegEmissions(kilometres(0), 0.3, 0.49, 2.68);
    expect(emissions.wellToTankGrams).toBe(0);
    expect(emissions.tankToWheelGrams).toBe(0);
    expect(emissions.wellToWheelGrams).toBe(0);
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

  it('the documented default price range includes the ETS2 price-containment anchor', () => {
    expect(ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE).toContain(
      ETS2_PRICE_CONTAINMENT_ANCHOR_EUR_PER_TONNE,
    );
    expect(ETS2_PRICE_CONTAINMENT_ANCHOR_EUR_PER_TONNE).toBe(45);
  });
});
