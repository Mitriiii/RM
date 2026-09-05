import { gramsCO2ePerTonneKilometre, kilograms, kilometres } from '@freyo/shared';
import type {
  CapacityPostingCandidateInput,
  MatchContext,
  MovementCandidateInput,
} from '../types.js';

/**
 * A movement/posting pair that satisfies every hard constraint with comfortable margin —
 * every constraint-violation test in matcher.test.ts starts here and changes exactly one
 * field, so a failure can be attributed to that one field with confidence.
 */
export function buildBaseMovement(
  overrides: Partial<MovementCandidateInput> = {},
): MovementCandidateInput {
  return {
    movementId: 'movement-1',
    shipperMemberId: 'shipper-1',
    originSiteId: 'site-madrid',
    destinationSiteId: 'site-zaragoza',
    originCountryCode: 'ES',
    destinationCountryCode: 'ES',
    equipment: { vehicleType: 'articulated-40t', temperatureClass: 'ambient', adrClasses: [] },
    grossWeightKg: kilograms(8_000),
    loadingMetres: 13.6,
    pickupWindow: {
      start: new Date('2026-03-01T08:00:00Z'),
      end: new Date('2026-03-01T12:00:00Z'),
    },
    deliveryWindow: {
      start: new Date('2026-03-01T14:00:00Z'),
      end: new Date('2026-03-01T18:00:00Z'),
    },
    loadingDwellMinutes: 30,
    unloadingDwellMinutes: 30,
    requiredDriveDurationMinutes: 240,
    ...overrides,
  };
}

export function buildBasePosting(
  overrides: Partial<CapacityPostingCandidateInput> = {},
): CapacityPostingCandidateInput {
  return {
    capacityPostingId: 'posting-1',
    carrierMemberId: 'carrier-1',
    homeCountryCode: 'ES',
    cabotagePermittedCountryCodes: [],
    equipment: { vehicleType: 'articulated-40t', temperatureClass: 'ambient', adrClasses: [] },
    capacityKg: kilograms(24_000),
    capacityLoadingMetres: 13.6,
    availableWindow: {
      start: new Date('2026-03-01T07:00:00Z'),
      end: new Date('2026-03-01T19:00:00Z'),
    },
    driverHoursRemainingMinutes: 480,
    plannedDeadheadKm: kilometres(300),
    emissionIntensity: gramsCO2ePerTonneKilometre(90),
    legDistanceKm: kilometres(300),
    ...overrides,
  };
}

export function buildBaseContext(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    isVisible: () => true,
    historicalAcceptanceRate: () => undefined,
    corridorDensity: () => 5,
    ...overrides,
  };
}
