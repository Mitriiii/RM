/**
 * Infers probable empty return running from shipment-only data (no telematics, no per-
 * vehicle GPS — see CLAUDE.md's out-of-scope list). The heuristic: for each undirected pair
 * of cities, count loaded trips in each direction. Whichever direction has fewer recorded
 * loaded trips is presumed to run empty for the difference — every outbound trip without a
 * matching inbound one implies somebody drove back with nothing to carry. This is an
 * aggregate, whole-history heuristic, not a per-vehicle match: it does not attempt to pair a
 * specific outbound trip with a specific return date. That is a documented simplification,
 * not a hidden one — a future version could add date-proximity matching per vehicle/carrier
 * once that data exists.
 */
export type EmptyDirection = 'AtoB' | 'BtoA' | 'balanced';

/**
 * A single shipment is not a pattern — see CLAUDE.md's rule against reporting a figure with
 * no data-quality context. A lane with fewer than this many total recorded movements is
 * reported back as having insufficient history rather than having an empty leg inferred from
 * it; see report.ts's insufficientDataLanes.
 */
export const MIN_TOTAL_TRIPS_FOR_INFERENCE = 2;

export interface LaneStats {
  readonly cityA: string;
  readonly cityB: string;
  readonly tripsAtoB: number;
  readonly tripsBtoA: number;
  readonly totalTrips: number;
  readonly emptyDirection: EmptyDirection;
  readonly probableEmptyTrips: number;
  readonly hasSufficientData: boolean;
}

export interface LaneTrip {
  readonly origin: string;
  readonly destination: string;
}

function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/** Orders two city names deterministically so a lane groups the same regardless of which
 * city a given trip lists as its origin. Returns a real tuple, not a widened string[], so
 * callers don't have to deal with a spurious "possibly undefined" from a 2-element array. */
export function sortedPair(a: string, b: string): readonly [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function detectEmptyLegs(trips: readonly LaneTrip[]): readonly LaneStats[] {
  const lanes = new Map<string, { cityA: string; cityB: string; aToB: number; bToA: number }>();

  for (const trip of trips) {
    const origin = normalizeCity(trip.origin);
    const destination = normalizeCity(trip.destination);
    if (origin === destination) continue; // not a lane — nothing to infer an empty return from

    const [cityA, cityB] = sortedPair(origin, destination);
    const key = `${cityA}|${cityB}`;
    const lane = lanes.get(key) ?? { cityA, cityB, aToB: 0, bToA: 0 };
    if (origin === cityA) {
      lane.aToB += 1;
    } else {
      lane.bToA += 1;
    }
    lanes.set(key, lane);
  }

  return [...lanes.values()].map((lane) => {
    const diff = lane.aToB - lane.bToA;
    const totalTrips = lane.aToB + lane.bToA;
    const emptyDirection: EmptyDirection = diff > 0 ? 'BtoA' : diff < 0 ? 'AtoB' : 'balanced';
    return {
      cityA: lane.cityA,
      cityB: lane.cityB,
      tripsAtoB: lane.aToB,
      tripsBtoA: lane.bToA,
      totalTrips,
      emptyDirection,
      probableEmptyTrips: Math.abs(diff),
      hasSufficientData: totalTrips >= MIN_TOTAL_TRIPS_FOR_INFERENCE,
    };
  });
}
