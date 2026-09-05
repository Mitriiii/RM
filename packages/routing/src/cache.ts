import type { Coordinates, RoutedDistance, RoutingClient, RoutingProfile } from './types.js';

export interface DistanceCacheKey {
  readonly origin: Coordinates;
  readonly destination: Coordinates;
  readonly profile: RoutingProfile;
  readonly routingEngineVersion: string;
}

/**
 * A persistent cache keyed by (origin, destination, profile, routingEngineVersion) — see
 * CLAUDE.md. Including routingEngineVersion in the key is what makes the cache safe to keep
 * across an engine or map-data upgrade: a version bump can never silently serve a distance
 * computed by a different engine build. This package only defines the interface and an
 * in-memory reference implementation; the actual persistent implementation is
 * @freyo/db's PostgresDistanceCache, which this package cannot depend on without creating a
 * circular dependency (packages/db already depends on this package's types).
 */
export interface DistanceCache {
  get(key: DistanceCacheKey): Promise<RoutedDistance | undefined>;
  set(key: DistanceCacheKey, value: RoutedDistance): Promise<void>;
}

const COORDINATE_PRECISION = 5; // ~1.1m at the equator — enough to dedupe the same site twice

/**
 * Exported so every DistanceCache implementation normalizes coordinates identically —
 * @freyo/db's PostgresDistanceCache uses this directly rather than reimplementing rounding,
 * so an in-memory cache and a Postgres one can never disagree about whether two coordinates
 * are "the same" for caching purposes.
 */
export function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
}

export function distanceCacheKeyToString(key: DistanceCacheKey): string {
  const origin = `${roundCoordinate(key.origin.longitude)},${roundCoordinate(key.origin.latitude)}`;
  const destination = `${roundCoordinate(key.destination.longitude)},${roundCoordinate(key.destination.latitude)}`;
  return `${origin}->${destination}|${key.profile}|${key.routingEngineVersion}`;
}

export function createInMemoryDistanceCache(): DistanceCache {
  const store = new Map<string, RoutedDistance>();
  return {
    async get(key) {
      return store.get(distanceCacheKeyToString(key));
    },
    async set(key, value) {
      store.set(distanceCacheKeyToString(key), value);
    },
  };
}

/**
 * Wraps a RoutingClient with a DistanceCache, keyed on the given routingEngineVersion (which
 * should match the client's own — this package doesn't enforce that automatically, since a
 * client's version is a config detail of whichever concrete client is passed in). A cache
 * hit skips the routing call entirely; a miss calls through and stores the result. Never
 * falls back to an estimate on a miss followed by a routing failure — the underlying
 * client's RoutingUnavailableError propagates unchanged.
 */
export function withDistanceCache(
  client: RoutingClient,
  cache: DistanceCache,
  routingEngineVersion: string,
): RoutingClient {
  return {
    async route(origin, destination, profile) {
      const key: DistanceCacheKey = { origin, destination, profile, routingEngineVersion };
      const cached = await cache.get(key);
      if (cached) return cached;

      const result = await client.route(origin, destination, profile);
      await cache.set(key, result);
      return result;
    },
  };
}
