import type { DistanceCacheKey, RoutedDistance } from '@freyo/routing';
import { kilometres } from '@freyo/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { PostgresDistanceCache } from './routingCache.js';
import { createAdminDb, type TestConnection } from './test-support/testDb.js';

const admin: TestConnection = createAdminDb();
const cache = new PostgresDistanceCache(admin.db);

afterAll(async () => {
  await admin.close();
});

const MADRID = { longitude: -3.7038, latitude: 40.4168 };
const ZARAGOZA = { longitude: -0.8891, latitude: 41.6488 };

function uniqueVersion(label: string): string {
  return `TEST_ONLY-${label}-${crypto.randomUUID().slice(0, 8)}`;
}

const SAMPLE_RESULT: RoutedDistance = {
  distance: kilometres(325),
  durationSeconds: 14_400,
  routingEngineVersion: '', // filled in per test with a unique version to avoid cross-test collisions
  profile: 'car',
};

describe('PostgresDistanceCache', () => {
  it('returns undefined for a key that was never set', async () => {
    const version = uniqueVersion('miss');
    const key: DistanceCacheKey = {
      origin: MADRID,
      destination: ZARAGOZA,
      profile: 'car',
      routingEngineVersion: version,
    };
    expect(await cache.get(key)).toBeUndefined();
  });

  it('returns what was set for the same key, surviving a fresh connection', async () => {
    const version = uniqueVersion('roundtrip');
    const key: DistanceCacheKey = {
      origin: MADRID,
      destination: ZARAGOZA,
      profile: 'car',
      routingEngineVersion: version,
    };
    await cache.set(key, { ...SAMPLE_RESULT, routingEngineVersion: version });

    // A fresh PostgresDistanceCache over a fresh admin connection — proves this is real
    // persistence, not an in-process cache the same object instance happens to remember.
    const otherConnection = createAdminDb();
    try {
      const otherCache = new PostgresDistanceCache(otherConnection.db);
      const result = await otherCache.get(key);
      expect(result?.distance).toBe(325);
      expect(result?.durationSeconds).toBe(14_400);
      expect(result?.routingEngineVersion).toBe(version);
      expect(result?.profile).toBe('car');
    } finally {
      await otherConnection.close();
    }
  });

  it('treats a different routingEngineVersion as a different key, even for the same coordinates', async () => {
    const v1 = uniqueVersion('v1');
    const v2 = uniqueVersion('v2');
    const baseKey = { origin: MADRID, destination: ZARAGOZA, profile: 'car' };
    await cache.set(
      { ...baseKey, routingEngineVersion: v1 },
      { ...SAMPLE_RESULT, routingEngineVersion: v1 },
    );

    const result = await cache.get({ ...baseKey, routingEngineVersion: v2 });
    expect(result).toBeUndefined();
  });

  it('rounds coordinates to the same precision as @freyo/routing, so near-identical points share a cache entry', async () => {
    const version = uniqueVersion('rounding');
    const key: DistanceCacheKey = {
      origin: MADRID,
      destination: ZARAGOZA,
      profile: 'car',
      routingEngineVersion: version,
    };
    await cache.set(key, { ...SAMPLE_RESULT, routingEngineVersion: version });

    const almostSameOrigin = { longitude: MADRID.longitude + 0.0000001, latitude: MADRID.latitude };
    const result = await cache.get({ ...key, origin: almostSameOrigin });
    expect(result?.distance).toBe(325);
  });

  it('a second set() for the same key updates the value rather than erroring on the unique index', async () => {
    const version = uniqueVersion('update');
    const key: DistanceCacheKey = {
      origin: MADRID,
      destination: ZARAGOZA,
      profile: 'car',
      routingEngineVersion: version,
    };
    await cache.set(key, {
      ...SAMPLE_RESULT,
      routingEngineVersion: version,
      distance: kilometres(325),
    });
    await cache.set(key, {
      ...SAMPLE_RESULT,
      routingEngineVersion: version,
      distance: kilometres(330),
    });

    const result = await cache.get(key);
    expect(result?.distance).toBe(330);
  });
});
