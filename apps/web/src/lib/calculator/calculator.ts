import { kilometres } from '@freyo/shared';
import {
  DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM,
  estimateEmptyLegDieselCostEur,
  estimateEmptyLegEmissions,
  ets2CostEur,
} from '@/lib/diagnostic/costs';
import type { VehicleCategory } from '@/lib/diagnostic/equipment';

export const MIN_ROUND_TRIPS_PER_MONTH = 1;
export const MAX_ROUND_TRIPS_PER_MONTH = 500;

export function isValidRoundTripsPerMonth(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= MIN_ROUND_TRIPS_PER_MONTH &&
    value <= MAX_ROUND_TRIPS_PER_MONTH
  );
}

export interface CalculatorCorridor {
  readonly id: string;
  readonly cityAName: string;
  readonly cityBName: string;
  readonly distanceKm: number;
}

export interface CalculatorInputs {
  readonly corridor: CalculatorCorridor;
  readonly vehicleCategory: VehicleCategory;
  readonly roundTripsPerMonth: number;
  readonly emptyRunningRatePercent: number;
  readonly dieselPriceEurPerLitre: number;
  readonly dieselWttKgCO2ePerLitre: number;
  readonly dieselTtwKgCO2ePerLitre: number;
  readonly carbonPricesEurPerTonne: readonly number[];
}

export interface Ets2Scenario {
  readonly carbonPriceEurPerTonne: number;
  readonly costEur: number;
}

export interface CalculatorResult {
  readonly totalKmPerMonth: number;
  readonly estimatedEmptyKmPerMonth: number;
  readonly estimatedEmptyTripsPerMonth: number;
  readonly dieselCostEurPerMonth: number;
  readonly wellToTankGrams: number;
  readonly tankToWheelGrams: number;
  readonly wellToWheelGrams: number;
  readonly ets2Scenarios: readonly Ets2Scenario[];
}

/**
 * The Instant Impact Calculator's only calculation path. It reuses apps/web's real empty-leg
 * fuel/CO2e estimator (apps/web/src/lib/diagnostic/costs.ts) — the exact same functions the
 * real empty-kilometre diagnostic report already uses — never a second, parallel
 * implementation. See ADR 0009: an empty leg carries zero cargo mass, so
 * packages/emissions's mass x distance x intensity formula is definitionally zero for it and
 * cannot represent a diesel engine burning fuel to move its own weight; this is why the real
 * diagnostic report already computes empty-leg CO2e this way instead of through
 * packages/emissions (ADR 0004), and the calculator reuses that same real, already-reviewed
 * method rather than reimplementing it. calculator.test.ts asserts this produces
 * byte-identical numbers to calling estimateEmptyLegEmissions/estimateEmptyLegDieselCostEur
 * directly with the same derived inputs — the test that proves one engine, not two.
 *
 * Eurostat's empty-running rate is a share of *all* vehicle-kilometres, loaded and unloaded
 * combined — not a claim that one specific leg of a round trip is always the empty one — so
 * the rate applies to the full round-trip distance (there and back), not just a return leg.
 *
 * Pure: no I/O, no randomness, no clock, nothing written anywhere. Same inputs, same result,
 * every time.
 */
export function calculateInstantImpact(inputs: CalculatorInputs): CalculatorResult {
  const totalKmPerRoundTrip = inputs.corridor.distanceKm * 2;
  const totalKmPerMonth = totalKmPerRoundTrip * inputs.roundTripsPerMonth;
  const emptyShare = inputs.emptyRunningRatePercent / 100;
  const estimatedEmptyKmPerMonth = totalKmPerMonth * emptyShare;
  const estimatedEmptyTripsPerMonth = inputs.roundTripsPerMonth * emptyShare;

  const consumptionLitresPerKm =
    DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM[inputs.vehicleCategory];
  const distance = kilometres(estimatedEmptyKmPerMonth);

  const dieselCostEurPerMonth = estimateEmptyLegDieselCostEur(distance, {
    consumptionLitresPerKm,
    priceEurPerLitre: inputs.dieselPriceEurPerLitre,
  });

  const emissions = estimateEmptyLegEmissions(
    distance,
    consumptionLitresPerKm,
    inputs.dieselWttKgCO2ePerLitre,
    inputs.dieselTtwKgCO2ePerLitre,
  );

  const ets2Scenarios: Ets2Scenario[] = inputs.carbonPricesEurPerTonne.map((price) => ({
    carbonPriceEurPerTonne: price,
    costEur: ets2CostEur(emissions.wellToWheelGrams, price),
  }));

  return {
    totalKmPerMonth,
    estimatedEmptyKmPerMonth,
    estimatedEmptyTripsPerMonth,
    dieselCostEurPerMonth,
    wellToTankGrams: emissions.wellToTankGrams,
    tankToWheelGrams: emissions.tankToWheelGrams,
    wellToWheelGrams: emissions.wellToWheelGrams,
    ets2Scenarios,
  };
}
