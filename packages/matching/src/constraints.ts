import type {
  CapacityPostingCandidateInput,
  ConstraintCheck,
  MovementCandidateInput,
  TemperatureClass,
} from './types.js';

const MINUTES_PER_MS = 1 / 60_000;

function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) * MINUTES_PER_MS;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function laterOf(a: Date, b: Date): Date {
  return a.getTime() > b.getTime() ? a : b;
}

function earlierOf(a: Date, b: Date): Date {
  return a.getTime() < b.getTime() ? a : b;
}

function checkEquipmentType(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
): ConstraintCheck {
  const satisfied = movement.equipment.vehicleType === posting.equipment.vehicleType;
  return {
    constraint: 'equipmentType',
    satisfied,
    explanation: satisfied
      ? `Posting offers ${posting.equipment.vehicleType}, matching what the movement requires.`
      : `Movement requires ${movement.equipment.vehicleType}; posting offers ${posting.equipment.vehicleType}.`,
  };
}

// Higher rank = more refrigeration capability. A frozen vehicle can also carry chilled or
// ambient cargo; an ambient-only vehicle cannot carry either.
const TEMPERATURE_CAPABILITY_RANK: Readonly<Record<TemperatureClass, number>> = {
  ambient: 0,
  chilled: 1,
  frozen: 2,
};

function checkTemperatureClass(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
): ConstraintCheck {
  const satisfied =
    TEMPERATURE_CAPABILITY_RANK[posting.equipment.temperatureClass] >=
    TEMPERATURE_CAPABILITY_RANK[movement.equipment.temperatureClass];
  return {
    constraint: 'temperatureClass',
    satisfied,
    explanation: satisfied
      ? `Posting's ${posting.equipment.temperatureClass} capability covers the movement's ${movement.equipment.temperatureClass} requirement.`
      : `Movement requires ${movement.equipment.temperatureClass}; posting only offers ${posting.equipment.temperatureClass}.`,
  };
}

function checkAdrClass(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
): ConstraintCheck {
  const missing = movement.equipment.adrClasses.filter(
    (adrClass) => !posting.equipment.adrClasses.includes(adrClass),
  );
  const satisfied = missing.length === 0;
  return {
    constraint: 'adrClass',
    satisfied,
    explanation: satisfied
      ? movement.equipment.adrClasses.length === 0
        ? 'Movement carries no dangerous goods.'
        : `Posting is certified for all required ADR classes (${movement.equipment.adrClasses.join(', ')}).`
      : `Posting is not certified for ADR class(es): ${missing.join(', ')}.`,
  };
}

function checkGrossWeight(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
): ConstraintCheck {
  const satisfied = movement.grossWeightKg <= posting.capacityKg;
  return {
    constraint: 'grossWeight',
    satisfied,
    explanation: `Movement weighs ${movement.grossWeightKg.toLocaleString()} kg; posting capacity is ${posting.capacityKg.toLocaleString()} kg.`,
  };
}

function checkLoadingMetres(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
): ConstraintCheck {
  const satisfied = movement.loadingMetres <= posting.capacityLoadingMetres;
  return {
    constraint: 'loadingMetres',
    satisfied,
    explanation: `Movement needs ${movement.loadingMetres} loading metres; posting offers ${posting.capacityLoadingMetres}.`,
  };
}

export interface TimeWindowFeasibility {
  readonly satisfied: boolean;
  readonly slackMinutes: number;
  readonly explanation: string;
}

/**
 * A simplified but real feasibility check, not a full routing/scheduling optimization: the
 * posting's available window must overlap both the effective loading window (pickup window,
 * extended by loading dwell) and the effective unloading window (delivery window, pulled
 * earlier by unloading dwell), and the posting's window must be long enough to physically
 * fit loading + driving + unloading. This does not attempt to place an exact departure time
 * within the window — that is a scheduling decision for whoever accepts the pairing, not
 * something this solver resolves.
 */
export function evaluateTimeWindowFeasibility(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
): TimeWindowFeasibility {
  const loadWindowEnd = addMinutes(movement.pickupWindow.end, movement.loadingDwellMinutes);
  const loadOverlapStart = laterOf(movement.pickupWindow.start, posting.availableWindow.start);
  const loadOverlapEnd = earlierOf(loadWindowEnd, posting.availableWindow.end);
  const loadOverlapMinutes = minutesBetween(loadOverlapStart, loadOverlapEnd);

  const unloadWindowStart = addMinutes(
    movement.deliveryWindow.start,
    -movement.unloadingDwellMinutes,
  );
  const unloadOverlapStart = laterOf(unloadWindowStart, posting.availableWindow.start);
  const unloadOverlapEnd = earlierOf(movement.deliveryWindow.end, posting.availableWindow.end);
  const unloadOverlapMinutes = minutesBetween(unloadOverlapStart, unloadOverlapEnd);

  const totalRequiredMinutes =
    movement.loadingDwellMinutes +
    movement.requiredDriveDurationMinutes +
    movement.unloadingDwellMinutes;
  const postingWindowMinutes = minutesBetween(
    posting.availableWindow.start,
    posting.availableWindow.end,
  );
  const durationFits = postingWindowMinutes >= totalRequiredMinutes;

  const loadFeasible = loadOverlapMinutes >= 0;
  const unloadFeasible = unloadOverlapMinutes >= 0;
  const satisfied = loadFeasible && unloadFeasible && durationFits;
  const slackMinutes = satisfied ? Math.min(loadOverlapMinutes, unloadOverlapMinutes) : 0;

  const explanation = !loadFeasible
    ? "Posting's available window does not overlap the movement's pickup window (plus loading dwell)."
    : !unloadFeasible
      ? "Posting's available window does not overlap the movement's delivery window (minus unloading dwell)."
      : !durationFits
        ? `Posting's window is ${Math.round(postingWindowMinutes)} min, shorter than the ${Math.round(totalRequiredMinutes)} min loading + driving + unloading needs.`
        : `${Math.round(slackMinutes)} min of scheduling slack at the tighter end of loading/unloading.`;

  return { satisfied, slackMinutes, explanation };
}

function checkTimeWindow(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
): ConstraintCheck {
  const feasibility = evaluateTimeWindowFeasibility(movement, posting);
  return {
    constraint: 'timeWindow',
    satisfied: feasibility.satisfied,
    explanation: feasibility.explanation,
  };
}

function checkDriverHours(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
): ConstraintCheck {
  const satisfied = posting.driverHoursRemainingMinutes >= movement.requiredDriveDurationMinutes;
  return {
    constraint: 'driverHours',
    satisfied,
    explanation: satisfied
      ? `Driver has ${Math.round(posting.driverHoursRemainingMinutes)} min remaining, enough for the ${Math.round(movement.requiredDriveDurationMinutes)} min drive.`
      : `Driver has only ${Math.round(posting.driverHoursRemainingMinutes)} min remaining; the drive needs ${Math.round(movement.requiredDriveDurationMinutes)} min.`,
  };
}

/**
 * A simplified model of EU cabotage rules (Regulation (EC) 1072/2009 art. 8): a carrier
 * performing a domestic haul in a country that is not its home country needs remaining
 * cabotage allowance there. This checks a precomputed "does this carrier currently have
 * allowance in this country" flag the caller maintains — it does not itself count the
 * "3 operations within 7 days of an inbound international delivery" rule the regulation
 * actually specifies. That counting logic belongs upstream, wherever
 * cabotagePermittedCountryCodes is produced, not in this pure constraint check.
 */
function checkCabotage(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
): ConstraintCheck {
  const isDomesticLeg = movement.originCountryCode === movement.destinationCountryCode;
  if (!isDomesticLeg) {
    return {
      constraint: 'cabotage',
      satisfied: true,
      explanation: 'Cross-border movement — cabotage rules apply to domestic legs, not this one.',
    };
  }

  const legCountry = movement.originCountryCode;
  if (legCountry === posting.homeCountryCode) {
    return {
      constraint: 'cabotage',
      satisfied: true,
      explanation: `Domestic haul within the carrier's home country (${legCountry}) — no cabotage restriction.`,
    };
  }

  const satisfied = posting.cabotagePermittedCountryCodes.includes(legCountry);
  return {
    constraint: 'cabotage',
    satisfied,
    explanation: satisfied
      ? `Carrier has declared remaining cabotage allowance in ${legCountry}.`
      : `Carrier is not domiciled in ${legCountry} and has no declared remaining cabotage allowance there.`,
  };
}

function checkMemberVisibility(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
  isVisible: (shipperMemberId: string, carrierMemberId: string) => boolean,
): ConstraintCheck {
  const satisfied = isVisible(movement.shipperMemberId, posting.carrierMemberId);
  return {
    constraint: 'memberVisibility',
    satisfied,
    explanation: satisfied
      ? 'These two members are visible to each other under current network permissions.'
      : 'One or both members have restricted visibility toward each other.',
  };
}

/**
 * Every hard constraint from CLAUDE.md, evaluated independently. A candidate is proposable
 * only when every check here is satisfied — see findCandidates in matcher.ts, which is the
 * only place that decision is made; this function only reports, it never filters.
 */
export function evaluateConstraints(
  movement: MovementCandidateInput,
  posting: CapacityPostingCandidateInput,
  isVisible: (shipperMemberId: string, carrierMemberId: string) => boolean,
): readonly ConstraintCheck[] {
  return [
    checkEquipmentType(movement, posting),
    checkTemperatureClass(movement, posting),
    checkAdrClass(movement, posting),
    checkGrossWeight(movement, posting),
    checkLoadingMetres(movement, posting),
    checkTimeWindow(movement, posting),
    checkDriverHours(movement, posting),
    checkCabotage(movement, posting),
    checkMemberVisibility(movement, posting, isVisible),
  ];
}
