import type { DistanceCache, DistanceCacheKey, RoutedDistance } from '@freyo/routing';
import { roundCoordinate } from '@freyo/routing';
import { kilometres } from '@freyo/shared';
import { and, eq } from 'drizzle-orm';
import type { Database } from './client.js';
import { routingDistanceCache } from './schema/index.js';

/**
 * The persistent implementation of @freyo/routing's DistanceCache — see
 * src/schema/routingDistanceCache.ts for why this table has no row-level security. Coordinates
 * are rounded with @freyo/routing's own roundCoordinate before every lookup and write, so this
 * cache and an in-memory one always agree on what counts as "the same" origin/destination.
 */
export class PostgresDistanceCache implements DistanceCache {
  constructor(private readonly db: Database) {}

  async get(key: DistanceCacheKey): Promise<RoutedDistance | undefined> {
    const [row] = await this.db
      .select()
      .from(routingDistanceCache)
      .where(
        and(
          eq(routingDistanceCache.originLongitude, roundCoordinate(key.origin.longitude)),
          eq(routingDistanceCache.originLatitude, roundCoordinate(key.origin.latitude)),
          eq(routingDistanceCache.destinationLongitude, roundCoordinate(key.destination.longitude)),
          eq(routingDistanceCache.destinationLatitude, roundCoordinate(key.destination.latitude)),
          eq(routingDistanceCache.profile, key.profile),
          eq(routingDistanceCache.routingEngineVersion, key.routingEngineVersion),
        ),
      );

    if (!row) return undefined;
    return {
      distance: kilometres(Number(row.distanceKm)),
      durationSeconds: row.durationSeconds,
      routingEngineVersion: row.routingEngineVersion,
      profile: row.profile,
    };
  }

  async set(key: DistanceCacheKey, value: RoutedDistance): Promise<void> {
    await this.db
      .insert(routingDistanceCache)
      .values({
        originLongitude: roundCoordinate(key.origin.longitude),
        originLatitude: roundCoordinate(key.origin.latitude),
        destinationLongitude: roundCoordinate(key.destination.longitude),
        destinationLatitude: roundCoordinate(key.destination.latitude),
        profile: key.profile,
        routingEngineVersion: key.routingEngineVersion,
        distanceKm: value.distance.toString(),
        durationSeconds: value.durationSeconds,
      })
      .onConflictDoUpdate({
        target: [
          routingDistanceCache.originLongitude,
          routingDistanceCache.originLatitude,
          routingDistanceCache.destinationLongitude,
          routingDistanceCache.destinationLatitude,
          routingDistanceCache.profile,
          routingDistanceCache.routingEngineVersion,
        ],
        set: { distanceKm: value.distance.toString(), durationSeconds: value.durationSeconds },
      });
  }
}
