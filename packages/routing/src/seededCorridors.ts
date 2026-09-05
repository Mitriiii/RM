import { kilometres } from '@freyo/shared';
import { createInMemoryDistanceCache, type DistanceCache } from './cache.js';
import type { Coordinates } from './types.js';

/**
 * Real routed distances for a small, fixed list of Spanish corridors, captured once from the
 * real OSRM public-demo engine (the same instance ADR 0004 already established as legitimate
 * real routing for this codebase's non-production use — never a great-circle/straight-line
 * approximation, per CLAUDE.md non-negotiable #3) on 2026-09-05, `car` profile (the public
 * server has no truck profile — see ADR 0004's "not truck-accurate" caveat, which applies here
 * identically). This exists so the Instant Impact Calculator (a public, no-signup, front-door
 * screen) doesn't need a live per-keystroke routing call against a shared public server for
 * every dropdown change; it is not a substitute for real routing anywhere a full shipment
 * history is actually being processed (see `apps/web/src/app/diagnostic`, which still calls
 * the routing engine directly for every uploaded file).
 *
 * If these corridors' underlying map data changes meaningfully, re-run the capture and update
 * both the values below and the date in this comment — never hand-edit a distance.
 */
export const SEEDED_CORRIDOR_ROUTING_ENGINE_VERSION = 'osrm-public-demo-DO_NOT_USE_IN_PRODUCTION';
export const SEEDED_CORRIDOR_ROUTING_PROFILE = 'car';
export const SEEDED_CORRIDOR_CAPTURE_DATE = '2026-09-05';

export interface SeededCity {
  readonly key: string;
  readonly name: string;
  readonly coordinates: Coordinates;
}

export const SEEDED_CITIES: readonly SeededCity[] = [
  { key: 'madrid', name: 'Madrid', coordinates: { longitude: -3.7038, latitude: 40.4168 } },
  { key: 'zaragoza', name: 'Zaragoza', coordinates: { longitude: -0.8891, latitude: 41.6488 } },
  { key: 'barcelona', name: 'Barcelona', coordinates: { longitude: 2.1686, latitude: 41.3874 } },
  { key: 'valencia', name: 'Valencia', coordinates: { longitude: -0.3763, latitude: 39.4699 } },
];

export interface SeededCorridor {
  readonly id: string;
  readonly cityAKey: string;
  readonly cityBKey: string;
  readonly distanceKm: number;
}

export const SEEDED_CORRIDORS: readonly SeededCorridor[] = [
  { id: 'madrid-zaragoza', cityAKey: 'madrid', cityBKey: 'zaragoza', distanceKm: 312.1777 },
  { id: 'madrid-barcelona', cityAKey: 'madrid', cityBKey: 'barcelona', distanceKm: 617.0183 },
  { id: 'zaragoza-barcelona', cityAKey: 'zaragoza', cityBKey: 'barcelona', distanceKm: 308.6421 },
  { id: 'madrid-valencia', cityAKey: 'madrid', cityBKey: 'valencia', distanceKm: 356.6563 },
];

function findCity(key: string): SeededCity {
  const city = SEEDED_CITIES.find((c) => c.key === key);
  if (!city) throw new RangeError(`seededCorridors: unknown city key "${key}"`);
  return city;
}

/**
 * Builds a real DistanceCache (this package's own interface — see cache.ts), pre-populated
 * with the captured corridors above. A caller reading through the returned cache is reading
 * through the exact same DistanceCache abstraction a live routing client would populate —
 * this function only changes how it got seeded, not what kind of thing it is.
 */
export async function createSeededCorridorCache(): Promise<DistanceCache> {
  const cache = createInMemoryDistanceCache();
  for (const corridor of SEEDED_CORRIDORS) {
    const origin = findCity(corridor.cityAKey).coordinates;
    const destination = findCity(corridor.cityBKey).coordinates;
    await cache.set(
      {
        origin,
        destination,
        profile: SEEDED_CORRIDOR_ROUTING_PROFILE,
        routingEngineVersion: SEEDED_CORRIDOR_ROUTING_ENGINE_VERSION,
      },
      {
        distance: kilometres(corridor.distanceKm),
        durationSeconds: 0,
        routingEngineVersion: SEEDED_CORRIDOR_ROUTING_ENGINE_VERSION,
        profile: SEEDED_CORRIDOR_ROUTING_PROFILE,
      },
    );
  }
  return cache;
}
