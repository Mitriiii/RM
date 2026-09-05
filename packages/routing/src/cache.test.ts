import { kilometres } from '@freyo/shared';
import { describe, expect, it } from 'vitest';
import { createInMemoryDistanceCache, withDistanceCache } from './cache.js';
import type { RoutedDistance, RoutingClient } from './types.js';
import { RoutingUnavailableError } from './types.js';

const MADRID = { longitude: -3.7038, latitude: 40.4168 };
const ZARAGOZA = { longitude: -0.8891, latitude: 41.6488 };

function countingClient(result: RoutedDistance): {
  client: RoutingClient;
  callCount: () => number;
} {
  let calls = 0;
  return {
    client: {
      route() {
        calls += 1;
        return Promise.resolve(result);
      },
    },
    callCount: () => calls,
  };
}

function failingClient(error: Error): RoutingClient {
  return {
    route() {
      return Promise.reject(error);
    },
  };
}

const SAMPLE_RESULT: RoutedDistance = {
  distance: kilometres(325),
  durationSeconds: 14_400,
  routingEngineVersion: 'osrm-5.27.1-iberia-TEST_ONLY',
  profile: 'car',
};

describe('createInMemoryDistanceCache', () => {
  it('returns undefined for a key that was never set', async () => {
    const cache = createInMemoryDistanceCache();
    const result = await cache.get({
      origin: MADRID,
      destination: ZARAGOZA,
      profile: 'car',
      routingEngineVersion: 'osrm-5.27.1-iberia-TEST_ONLY',
    });
    expect(result).toBeUndefined();
  });

  it('returns what was set for the same key', async () => {
    const cache = createInMemoryDistanceCache();
    const key = {
      origin: MADRID,
      destination: ZARAGOZA,
      profile: 'car',
      routingEngineVersion: 'osrm-5.27.1-iberia-TEST_ONLY',
    };
    await cache.set(key, SAMPLE_RESULT);
    expect(await cache.get(key)).toEqual(SAMPLE_RESULT);
  });

  it('treats a different routingEngineVersion as a different key, even for the same coordinates', async () => {
    const cache = createInMemoryDistanceCache();
    const baseKey = { origin: MADRID, destination: ZARAGOZA, profile: 'car' };
    await cache.set({ ...baseKey, routingEngineVersion: 'v1' }, SAMPLE_RESULT);
    const result = await cache.get({ ...baseKey, routingEngineVersion: 'v2' });
    expect(result).toBeUndefined();
  });

  it('treats a different profile as a different key, even for the same coordinates and version', async () => {
    const cache = createInMemoryDistanceCache();
    const baseKey = {
      origin: MADRID,
      destination: ZARAGOZA,
      routingEngineVersion: 'osrm-5.27.1-iberia-TEST_ONLY',
    };
    await cache.set({ ...baseKey, profile: 'car' }, SAMPLE_RESULT);
    const result = await cache.get({ ...baseKey, profile: 'hgv' });
    expect(result).toBeUndefined();
  });
});

describe('withDistanceCache', () => {
  it('calls the underlying client on a miss and stores the result', async () => {
    const { client, callCount } = countingClient(SAMPLE_RESULT);
    const cache = createInMemoryDistanceCache();
    const cachedClient = withDistanceCache(client, cache, SAMPLE_RESULT.routingEngineVersion);

    const result = await cachedClient.route(MADRID, ZARAGOZA, 'car');

    expect(result).toEqual(SAMPLE_RESULT);
    expect(callCount()).toBe(1);
  });

  it('does not call the underlying client again on a hit', async () => {
    const { client, callCount } = countingClient(SAMPLE_RESULT);
    const cache = createInMemoryDistanceCache();
    const cachedClient = withDistanceCache(client, cache, SAMPLE_RESULT.routingEngineVersion);

    await cachedClient.route(MADRID, ZARAGOZA, 'car');
    await cachedClient.route(MADRID, ZARAGOZA, 'car');
    await cachedClient.route(MADRID, ZARAGOZA, 'car');

    expect(callCount()).toBe(1);
  });

  it('a routing-engine-version bump causes a fresh call rather than reusing a stale cached distance', async () => {
    const { client, callCount } = countingClient(SAMPLE_RESULT);
    const cache = createInMemoryDistanceCache();

    const clientV1 = withDistanceCache(client, cache, 'v1');
    await clientV1.route(MADRID, ZARAGOZA, 'car');
    expect(callCount()).toBe(1);

    const clientV2 = withDistanceCache(client, cache, 'v2');
    await clientV2.route(MADRID, ZARAGOZA, 'car');
    expect(callCount()).toBe(2);
  });

  it('propagates RoutingUnavailableError on a miss rather than falling back to an estimate', async () => {
    const cache = createInMemoryDistanceCache();
    const cachedClient = withDistanceCache(
      failingClient(new RoutingUnavailableError('engine down')),
      cache,
      'osrm-5.27.1-iberia-TEST_ONLY',
    );

    await expect(cachedClient.route(MADRID, ZARAGOZA, 'car')).rejects.toThrow(
      RoutingUnavailableError,
    );
  });
});
