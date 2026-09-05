import type { GramsCO2e, Kilometres } from '@freyo/shared';
import { gramsCO2e } from '@freyo/shared';
import type { VehicleCategory } from './equipment';

/**
 * None of the figures below are audited emission factors from packages/factors — they are
 * approximate, published-ballpark constants for a single purpose: estimating the cost and
 * CO2e of a kilometre nobody has a shipment record for. Every one is a user-adjustable input
 * with a default and a source note, never a silent hard-coded number (CLAUDE.md's rule for
 * the ETS2 carbon price, applied here to every other assumption this diagnostic makes).
 *
 * This is deliberately not routed through packages/emissions's tonne-kilometre engine: that
 * engine's core formula is mass x distance x intensity, which is exactly zero whenever mass
 * is zero — correct for the audited Ledger, useless for describing what an *empty* truck
 * burns. Estimating an unladen leg's fuel and CO2e needs a distance/fuel-based method
 * instead, so it lives here, clearly labeled as a simplified estimate, not an ISO 14083
 * calculation.
 */

/** Typical unladen/lightly-loaded diesel consumption by vehicle category. Source: general
 * published HGV fuel-economy guidance (e.g. ACEA/manufacturer test-cycle figures for empty
 * running); real consumption varies by route, load, and driving style — adjust for your
 * fleet. */
export const DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM: Readonly<
  Record<VehicleCategory, number>
> = {
  rigid: 0.24,
  articulated: 0.33,
};

/**
 * A representative Spanish diesel pump price — €1.77/L, Spain national average, source:
 * GlobalPetrolPrices.com, captured 31 August 2026. This is a starting point, not a live feed:
 * diesel moves week to week, this constant does not, and both the diagnostic and the Instant
 * Impact Calculator surface it as an editable field with this source and date shown, never as
 * an authoritative live price. TODO: revisit and re-cite this figure periodically (e.g. every
 * few months) — it will otherwise silently go stale.
 */
export const DEFAULT_DIESEL_PRICE_EUR_PER_LITRE = 1.77;
export const DEFAULT_DIESEL_PRICE_SOURCE = 'GlobalPetrolPrices.com, Spain average';
export const DEFAULT_DIESEL_PRICE_CAPTURED_ON = '2026-08-31';

/**
 * Diesel's well-to-wheel emission factor, split into its two components per CLAUDE.md's
 * "report well-to-tank, tank-to-wheel, and well-to-wheel" rule — applied here to the
 * diagnostic's simplified fuel-based estimate the same way it applies to the audited engine.
 * Well-to-wheel is always the sum of these two, never an independently adjustable third
 * number, so it can never drift from what its own components say. Commonly published range
 * ~3.15-3.2 kgCO2e/L combined (e.g. UK DEFRA/BEIS-style GHG conversion factors) — an
 * approximation, not an audited figure.
 */
export const DEFAULT_DIESEL_WTT_KG_CO2E_PER_LITRE = 0.49; // upstream production & distribution
export const DEFAULT_DIESEL_TTW_KG_CO2E_PER_LITRE = 2.68; // combustion

/**
 * ETS2 brings road transport fuel into EU carbon pricing from 1 January 2028. €45/tCO2e
 * (2020-adjusted) is the system's price-containment threshold — the level at which extra
 * allowances release if the price rises too quickly in its first two years — the closest
 * thing to an official anchor price this market has. €63 is the upper end of pre-delay
 * projections (ICAP/EEA/Transport & Environment); €0 is included to show the cost case with
 * no carbon price at all, since the date has already slipped once. Every scenario here is a
 * user-adjustable input, never a single hard-coded "the" price.
 */
export const ETS2_PRICE_CONTAINMENT_ANCHOR_EUR_PER_TONNE = 45;
export const ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE: readonly number[] = [0, 45, 50, 63];

export interface DieselCostInputs {
  readonly consumptionLitresPerKm: number;
  readonly priceEurPerLitre: number;
}

export function estimateEmptyLegDieselCostEur(
  distance: Kilometres,
  inputs: DieselCostInputs,
): number {
  return distance * inputs.consumptionLitresPerKm * inputs.priceEurPerLitre;
}

export interface EmptyLegEmissions {
  readonly wellToTankGrams: GramsCO2e;
  readonly tankToWheelGrams: GramsCO2e;
  readonly wellToWheelGrams: GramsCO2e;
}

const GRAMS_PER_KG = 1_000;

export function estimateEmptyLegEmissions(
  distance: Kilometres,
  consumptionLitresPerKm: number,
  wttKgCO2ePerLitre: number,
  ttwKgCO2ePerLitre: number,
): EmptyLegEmissions {
  const litres = distance * consumptionLitresPerKm;
  const wellToTankGrams = gramsCO2e(litres * wttKgCO2ePerLitre * GRAMS_PER_KG);
  const tankToWheelGrams = gramsCO2e(litres * ttwKgCO2ePerLitre * GRAMS_PER_KG);
  const wellToWheelGrams = gramsCO2e(wellToTankGrams + tankToWheelGrams);
  return { wellToTankGrams, tankToWheelGrams, wellToWheelGrams };
}

export function ets2CostEur(co2e: GramsCO2e, carbonPriceEurPerTonne: number): number {
  const tonnes = co2e / 1_000_000;
  return tonnes * carbonPriceEurPerTonne;
}
