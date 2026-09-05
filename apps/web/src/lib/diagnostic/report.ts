import type { RoutingClient } from '@freyo/routing';
import { kilometres } from '@freyo/shared';
import { estimateEmptyLegCO2e, estimateEmptyLegDieselCostEur } from './costs';
import { detectEmptyLegs, sortedPair, type EmptyDirection } from './emptyLegDetection';
import { normalizeEquipmentType, type VehicleCategory } from './equipment';
import { resolveCity } from './gazetteer';
import type { MappedShipmentRow, RowError } from './types';

export interface DiagnosticReportInputs {
  readonly rows: readonly MappedShipmentRow[];
  readonly routingClient: RoutingClient;
  readonly routingProfile: string;
  readonly dieselPriceEurPerLitre: number;
  readonly dieselConsumptionLPerKm: Readonly<Record<VehicleCategory, number>>;
  readonly dieselWtwKgCO2ePerLitre: number;
}

export interface LaneReportRow {
  readonly cityA: string;
  readonly cityB: string;
  readonly tripsAtoB: number;
  readonly tripsBtoA: number;
  readonly emptyDirection: EmptyDirection;
  readonly probableEmptyTrips: number;
  readonly distanceKm: number;
  readonly assumedVehicleCategory: VehicleCategory;
  readonly emptyKm: number;
  readonly emptyDieselCostEur: number;
  readonly emptyCO2eGrams: number;
}

export interface DiagnosticReport {
  readonly lanes: readonly LaneReportRow[];
  readonly totalEmptyKm: number;
  readonly totalEmptyDieselCostEur: number;
  readonly totalEmptyCO2eGrams: number;
  readonly issues: readonly RowError[];
  readonly routingEngineVersion: string | undefined;
}

function majorityVehicleCategory(categories: readonly VehicleCategory[]): VehicleCategory {
  let rigid = 0;
  let articulated = 0;
  for (const category of categories) {
    if (category === 'rigid') rigid += 1;
    else articulated += 1;
  }
  return articulated >= rigid ? 'articulated' : 'rigid';
}

function laneKey(cityA: string, cityB: string): string {
  return `${cityA}|${cityB}`;
}

/**
 * Turns validated shipment rows into the empty-kilometre diagnostic report: resolves each
 * row's city text and equipment type (reporting anything unresolvable as an issue rather
 * than skipping it silently), infers probable empty return legs per lane, routes each lane
 * that needs one, and estimates that empty running's diesel cost and CO2e. Routes are
 * fetched sequentially, not in parallel — see packages/routing/README.md on not hammering a
 * shared or public routing engine with concurrent requests.
 */
export async function buildDiagnosticReport(
  inputs: DiagnosticReportInputs,
): Promise<DiagnosticReport> {
  const issues: RowError[] = [];
  const validTrips: { origin: string; destination: string; category: VehicleCategory }[] = [];

  for (const row of inputs.rows) {
    const originResolved = resolveCity(row.origin);
    const destinationResolved = resolveCity(row.destination);
    const category = normalizeEquipmentType(row.equipmentType);

    if (!originResolved.ok) {
      issues.push({
        rowNumber: row.rowNumber,
        message: `Unknown origin city "${row.origin}" — not in the supported city list.`,
      });
      continue;
    }
    if (!destinationResolved.ok) {
      issues.push({
        rowNumber: row.rowNumber,
        message: `Unknown destination city "${row.destination}" — not in the supported city list.`,
      });
      continue;
    }
    if (!category) {
      issues.push({
        rowNumber: row.rowNumber,
        message: `Unrecognized equipment type "${row.equipmentType}".`,
      });
      continue;
    }
    validTrips.push({ origin: row.origin, destination: row.destination, category });
  }

  const laneStats = detectEmptyLegs(validTrips);

  const categoriesByLane = new Map<string, VehicleCategory[]>();
  for (const trip of validTrips) {
    const [cityA, cityB] = sortedPair(
      trip.origin.trim().toLowerCase(),
      trip.destination.trim().toLowerCase(),
    );
    const key = laneKey(cityA, cityB);
    const existing = categoriesByLane.get(key) ?? [];
    existing.push(trip.category);
    categoriesByLane.set(key, existing);
  }

  const lanes: LaneReportRow[] = [];
  let totalEmptyKm = 0;
  let totalEmptyDieselCostEur = 0;
  let totalEmptyCO2eGrams = 0;
  let routingEngineVersion: string | undefined;

  for (const lane of laneStats) {
    if (lane.probableEmptyTrips === 0) continue;

    const originResolved = resolveCity(lane.cityA);
    const destinationResolved = resolveCity(lane.cityB);
    if (!originResolved.ok || !destinationResolved.ok) continue; // already reported as an issue above

    const routed = await inputs.routingClient.route(
      originResolved.coordinates,
      destinationResolved.coordinates,
      inputs.routingProfile,
    );
    routingEngineVersion ??= routed.routingEngineVersion;

    const category = majorityVehicleCategory(
      categoriesByLane.get(laneKey(lane.cityA, lane.cityB)) ?? ['articulated'],
    );
    const consumptionLPerKm = inputs.dieselConsumptionLPerKm[category];
    const emptyKm = routed.distance * lane.probableEmptyTrips;
    const emptyDieselCostEur = estimateEmptyLegDieselCostEur(kilometres(emptyKm), {
      consumptionLitresPerKm: consumptionLPerKm,
      priceEurPerLitre: inputs.dieselPriceEurPerLitre,
    });
    const emptyCO2eGrams = estimateEmptyLegCO2e(
      kilometres(emptyKm),
      consumptionLPerKm,
      inputs.dieselWtwKgCO2ePerLitre,
    );

    lanes.push({
      cityA: lane.cityA,
      cityB: lane.cityB,
      tripsAtoB: lane.tripsAtoB,
      tripsBtoA: lane.tripsBtoA,
      emptyDirection: lane.emptyDirection,
      probableEmptyTrips: lane.probableEmptyTrips,
      distanceKm: routed.distance,
      assumedVehicleCategory: category,
      emptyKm,
      emptyDieselCostEur,
      emptyCO2eGrams,
    });

    totalEmptyKm += emptyKm;
    totalEmptyDieselCostEur += emptyDieselCostEur;
    totalEmptyCO2eGrams += emptyCO2eGrams;
  }

  lanes.sort((a, b) => b.emptyKm - a.emptyKm);

  return {
    lanes,
    totalEmptyKm,
    totalEmptyDieselCostEur,
    totalEmptyCO2eGrams,
    issues,
    routingEngineVersion,
  };
}
