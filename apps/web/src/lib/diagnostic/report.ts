import type { RoutingClient } from '@freyo/routing';
import { gramsCO2e, kilometres, type GramsCO2e } from '@freyo/shared';
import { estimateEmptyLegDieselCostEur, estimateEmptyLegEmissions } from './costs';
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
  readonly dieselWttKgCO2ePerLitre: number;
  readonly dieselTtwKgCO2ePerLitre: number;
}

/**
 * Nothing in this diagnostic is measured, so "primary" never applies here — but a lane
 * inferred from more observed movements is a more reliable pattern than one just above the
 * minimum threshold. CLAUDE.md's "never show a figure without its data-quality grade"
 * applies to this heuristic estimate the same way it applies to a measured one.
 */
export type LaneConfidenceGrade = 'modelled' | 'default';
/** Exported so the report screen's plain-language confidence explanation can cite this exact
 * number instead of restating it as a separately hand-written claim that could drift. */
export const MODELLED_MIN_MOVEMENTS_OBSERVED = 5;

function laneConfidenceGrade(movementsObserved: number): LaneConfidenceGrade {
  return movementsObserved >= MODELLED_MIN_MOVEMENTS_OBSERVED ? 'modelled' : 'default';
}

export interface LaneReportRow {
  readonly cityA: string;
  readonly cityB: string;
  readonly tripsAtoB: number;
  readonly tripsBtoA: number;
  readonly movementsObserved: number;
  readonly emptyDirection: EmptyDirection;
  readonly probableEmptyTrips: number;
  readonly distanceKm: number;
  readonly assumedVehicleCategory: VehicleCategory;
  readonly emptyKm: number;
  readonly emptyDieselCostEur: number;
  readonly wellToTankGrams: number;
  readonly tankToWheelGrams: number;
  readonly wellToWheelGrams: number;
  readonly confidenceGrade: LaneConfidenceGrade;
}

/** A lane with too few recorded movements to infer an empty-return pattern from — reported
 * back honestly rather than silently folded into (or silently dropped from) the main table. */
export interface InsufficientDataLane {
  readonly cityA: string;
  readonly cityB: string;
  readonly movementsObserved: number;
}

export interface DiagnosticReport {
  readonly lanes: readonly LaneReportRow[];
  readonly insufficientDataLanes: readonly InsufficientDataLane[];
  readonly totalEmptyKm: number;
  readonly totalEmptyDieselCostEur: number;
  readonly totalWellToTankGrams: GramsCO2e;
  readonly totalTankToWheelGrams: GramsCO2e;
  readonly totalWellToWheelGrams: GramsCO2e;
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
 * that needs one, and estimates that empty running's diesel cost and CO2e — reported as
 * well-to-tank, tank-to-wheel, and well-to-wheel, per CLAUDE.md's reporting requirement.
 * Routes are fetched sequentially, not in parallel — see packages/routing/README.md on not
 * hammering a shared or public routing engine with concurrent requests.
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
  const insufficientDataLanes: InsufficientDataLane[] = [];
  let totalEmptyKm = 0;
  let totalEmptyDieselCostEur = 0;
  let totalWellToTankGrams = 0;
  let totalTankToWheelGrams = 0;
  let totalWellToWheelGrams = 0;
  let routingEngineVersion: string | undefined;

  for (const lane of laneStats) {
    if (!lane.hasSufficientData) {
      insufficientDataLanes.push({
        cityA: lane.cityA,
        cityB: lane.cityB,
        movementsObserved: lane.totalTrips,
      });
      continue;
    }
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
    const emissions = estimateEmptyLegEmissions(
      kilometres(emptyKm),
      consumptionLPerKm,
      inputs.dieselWttKgCO2ePerLitre,
      inputs.dieselTtwKgCO2ePerLitre,
    );

    lanes.push({
      cityA: lane.cityA,
      cityB: lane.cityB,
      tripsAtoB: lane.tripsAtoB,
      tripsBtoA: lane.tripsBtoA,
      movementsObserved: lane.totalTrips,
      emptyDirection: lane.emptyDirection,
      probableEmptyTrips: lane.probableEmptyTrips,
      distanceKm: routed.distance,
      assumedVehicleCategory: category,
      emptyKm,
      emptyDieselCostEur,
      wellToTankGrams: emissions.wellToTankGrams,
      tankToWheelGrams: emissions.tankToWheelGrams,
      wellToWheelGrams: emissions.wellToWheelGrams,
      confidenceGrade: laneConfidenceGrade(lane.totalTrips),
    });

    totalEmptyKm += emptyKm;
    totalEmptyDieselCostEur += emptyDieselCostEur;
    totalWellToTankGrams += emissions.wellToTankGrams;
    totalTankToWheelGrams += emissions.tankToWheelGrams;
    totalWellToWheelGrams += emissions.wellToWheelGrams;
  }

  lanes.sort((a, b) => b.emptyKm - a.emptyKm);

  return {
    lanes,
    insufficientDataLanes,
    totalEmptyKm,
    totalEmptyDieselCostEur,
    totalWellToTankGrams: gramsCO2e(totalWellToTankGrams),
    totalTankToWheelGrams: gramsCO2e(totalTankToWheelGrams),
    totalWellToWheelGrams: gramsCO2e(totalWellToWheelGrams),
    issues,
    routingEngineVersion,
  };
}
