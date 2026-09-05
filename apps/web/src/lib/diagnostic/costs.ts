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

/** A representative Spanish diesel pump price — check the current price; this moves with
 * the market and is not fetched live. */
export const DEFAULT_DIESEL_PRICE_EUR_PER_LITRE = 1.55;

/** Well-to-wheel diesel emission factor: combustion (~2.68 kgCO2/L) plus upstream well-to-
 * tank production and distribution (~0.5 kgCO2e/L) — commonly published range ~3.15-3.2
 * kgCO2e/L (e.g. UK DEFRA/BEIS-style GHG conversion factors). An approximation, not an
 * audited figure. */
export const DEFAULT_DIESEL_WTW_KG_CO2E_PER_LITRE = 3.17;

/** CLAUDE.md/docs/FREYO-Concept-v2.md: ETS2 allowance price pre-delay projections ran
 * roughly €40-63/tCO2e (ICAP/EEA/Transport & Environment). €0 is included so the diagnostic
 * can show "the cost case today, with zero carbon price," per the concept doc's own
 * mitigation for the risk that ETS2 slips again. */
export const ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE: readonly number[] = [0, 40, 50, 63];

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

export function estimateEmptyLegCO2e(
  distance: Kilometres,
  consumptionLitresPerKm: number,
  wtwKgCO2ePerLitre: number,
): GramsCO2e {
  const litres = distance * consumptionLitresPerKm;
  const kgCO2e = litres * wtwKgCO2ePerLitre;
  return gramsCO2e(kgCO2e * 1_000);
}

export function ets2CostEur(co2e: GramsCO2e, carbonPriceEurPerTonne: number): number {
  const tonnes = co2e / 1_000_000;
  return tonnes * carbonPriceEurPerTonne;
}
