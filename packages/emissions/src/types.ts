import type {
  FactorSetId,
  MissingFactorError,
  TransportOperationCategoryKey,
} from '@freyo/factors';
import type { GramsCO2e, Kilograms, Kilometres, TonneKilometres } from '@freyo/shared';

/**
 * Primary (metered fuel, telematics) > modelled > default (EU/ISO default factors applied to
 * generic activity data). See CLAUDE.md — every result must carry this grade, and it is never
 * computed by this package: the caller knows where its mass, distance, and TOC assignment
 * came from, and passes the grade in.
 */
export type DataQualityGrade = 'primary' | 'modelled' | 'default';

/**
 * One transport chain element (leg): a single vehicle movement belonging to one transport
 * operation category, covering a routed distance. `routingSource` identifies the routing
 * engine and version that produced `distance` (e.g. `'osrm-5.27.1-iberia'`) — this package
 * never computes or looks up a distance itself, it only records where the caller's came from.
 */
export interface LegInput {
  readonly toc: TransportOperationCategoryKey;
  readonly distance: Kilometres;
  readonly routingSource: string;
  readonly dataQuality: DataQualityGrade;
}

/** One shipment's mass share of a leg. A leg with more than one entry is a shared/pooled leg. */
export interface ShipmentOnLeg {
  readonly shipmentId: string;
  readonly mass: Kilograms;
}

/** The leg's totals, before allocation to individual shipments. */
export interface LegEmissionsTotals {
  readonly activity: TonneKilometres;
  readonly wellToTank: GramsCO2e;
  readonly tankToWheel: GramsCO2e;
  readonly wellToWheel: GramsCO2e;
}

/**
 * One shipment's allocated share of one leg's emissions — the atomic, immutable result of
 * this engine. Carries every input CLAUDE.md requires for reproducibility: the leg inputs,
 * the exact factor-set id used, the engine version, and the data-quality grade. Re-running
 * this calculation with the same arguments must always produce the same numbers.
 */
export interface ShipmentEmissionRecord {
  readonly shipmentId: string;
  readonly leg: LegInput;
  readonly shipmentMass: Kilograms;
  readonly legTotalMass: Kilograms;
  /** shipmentMass / legTotalMass — the allocation driver. Mass-based, per CLAUDE.md/GLEC. */
  readonly allocationShare: number;
  readonly factorSetId: FactorSetId;
  readonly gwpSet: string;
  readonly engineVersion: string;
  readonly dataQuality: DataQualityGrade;
  readonly wellToTank: GramsCO2e;
  readonly tankToWheel: GramsCO2e;
  readonly wellToWheel: GramsCO2e;
}

/**
 * The only two shapes a leg calculation can return. There is no third case carrying a
 * guessed or default-substituted intensity — see CLAUDE.md's "never invent an emission
 * factor". A missing factor propagates as the same MissingFactorError packages/factors
 * raised, not a new, lossier error type.
 */
export type LegEmissionsResult =
  | {
      readonly ok: true;
      readonly totals: LegEmissionsTotals;
      readonly shipments: readonly ShipmentEmissionRecord[];
    }
  | { readonly ok: false; readonly error: MissingFactorError };

/** One shipment's summed emissions across every leg of its transport chain. */
export interface TransportChainEmissions {
  readonly shipmentId: string;
  readonly legs: readonly ShipmentEmissionRecord[];
  readonly wellToTank: GramsCO2e;
  readonly tankToWheel: GramsCO2e;
  readonly wellToWheel: GramsCO2e;
}
