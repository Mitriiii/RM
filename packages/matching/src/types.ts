import type { GramsCO2ePerTonneKilometre, Kilograms, Kilometres } from '@freyo/shared';

export type TemperatureClass = 'ambient' | 'chilled' | 'frozen';

export interface EquipmentSpec {
  readonly vehicleType: string;
  readonly temperatureClass: TemperatureClass;
  /** ADR dangerous-goods classes. On a movement: what the cargo requires. On a posting: what
   * the vehicle and driver are certified to carry. Empty means no dangerous goods either way. */
  readonly adrClasses: readonly string[];
}

export interface TimeWindow {
  readonly start: Date;
  readonly end: Date;
}

/**
 * One shipper's cargo needing transport, already reduced to the fields the constraint solver
 * and scorer need. This package does not compute distances, routes, or emission factors
 * itself — legDistanceKm, requiredDriveDurationMinutes, and emissionIntensity are the
 * caller's job (packages/routing, packages/factors) to resolve upstream, the same way
 * packages/emissions takes a FactorSet rather than looking one up itself. This package also
 * does not decide *which* postings are worth considering for a movement (a geographic/route
 * search) — it filters and scores a candidate list the caller already assembled.
 */
export interface MovementCandidateInput {
  readonly movementId: string;
  readonly shipperMemberId: string;
  readonly originSiteId: string;
  readonly destinationSiteId: string;
  readonly originCountryCode: string;
  readonly destinationCountryCode: string;
  readonly equipment: EquipmentSpec;
  readonly grossWeightKg: Kilograms;
  readonly loadingMetres: number;
  readonly pickupWindow: TimeWindow;
  readonly deliveryWindow: TimeWindow;
  readonly loadingDwellMinutes: number;
  readonly unloadingDwellMinutes: number;
  /** Estimated drive time for this specific movement on this specific posting's route. */
  readonly requiredDriveDurationMinutes: number;
}

/** A carrier member's declared truck availability, being evaluated against one movement. */
export interface CapacityPostingCandidateInput {
  readonly capacityPostingId: string;
  readonly carrierMemberId: string;
  readonly homeCountryCode: string;
  /** Countries where this carrier currently has declared remaining cabotage allowance — see
   * constraints.ts's cabotage check for what this does and does not model. */
  readonly cabotagePermittedCountryCodes: readonly string[];
  readonly equipment: EquipmentSpec;
  readonly capacityKg: Kilograms;
  readonly capacityLoadingMetres: number;
  readonly availableWindow: TimeWindow;
  readonly driverHoursRemainingMinutes: number;
  /** How much empty running this posting's vehicle would do on this route without any match. */
  readonly plannedDeadheadKm: Kilometres;
  /** This vehicle's transport-operation-category emission intensity (packages/factors). */
  readonly emissionIntensity: GramsCO2ePerTonneKilometre;
  /** Distance of the proposed movement's leg on this posting's route. */
  readonly legDistanceKm: Kilometres;
}

export type ConstraintName =
  | 'equipmentType'
  | 'temperatureClass'
  | 'adrClass'
  | 'grossWeight'
  | 'loadingMetres'
  | 'timeWindow'
  | 'driverHours'
  | 'cabotage'
  | 'memberVisibility';

export interface ConstraintCheck {
  readonly constraint: ConstraintName;
  readonly satisfied: boolean;
  readonly explanation: string;
}

/**
 * Every component named and returned separately — CLAUDE.md's "match explanations are
 * mandatory... no opaque ranking." historicalAcceptanceRate is null, not a fabricated
 * neutral default, when these two members have no prior pairing history.
 */
export interface ScoreComponents {
  readonly deadheadKmAvoided: number;
  readonly co2eAvoidedGrams: number;
  readonly timeWindowSlackMinutes: number;
  readonly corridorDensity: number;
  readonly historicalAcceptanceRate: number | null;
}

export interface MatchCandidate {
  readonly movementId: string;
  readonly capacityPostingId: string;
  readonly constraints: readonly ConstraintCheck[];
  readonly score: ScoreComponents;
}

/**
 * External lookups the solver needs but cannot compute itself without I/O — supplied by the
 * caller (eventually backed by packages/db), the same dependency-injection shape
 * packages/emissions uses for its FactorSet.
 */
export interface MatchContext {
  readonly isVisible: (shipperMemberId: string, carrierMemberId: string) => boolean;
  /** Undefined when these two members have no prior pairing history — never guessed. */
  readonly historicalAcceptanceRate: (
    shipperMemberId: string,
    carrierMemberId: string,
  ) => number | undefined;
  readonly corridorDensity: (originSiteId: string, destinationSiteId: string) => number;
}
