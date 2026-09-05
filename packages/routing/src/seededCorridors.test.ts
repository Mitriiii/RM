import { describe, expect, it } from 'vitest';
import {
  SEEDED_CITIES,
  SEEDED_CORRIDORS,
  SEEDED_CORRIDOR_ROUTING_ENGINE_VERSION,
  SEEDED_CORRIDOR_ROUTING_PROFILE,
  createSeededCorridorCache,
} from './seededCorridors.js';

describe('seededCorridors', () => {
  it('reads every seeded corridor back through the real DistanceCache interface', async () => {
    const cache = await createSeededCorridorCache();

    for (const corridor of SEEDED_CORRIDORS) {
      const cityA = SEEDED_CITIES.find((c) => c.key === corridor.cityAKey)!;
      const cityB = SEEDED_CITIES.find((c) => c.key === corridor.cityBKey)!;
      const cached = await cache.get({
        origin: cityA.coordinates,
        destination: cityB.coordinates,
        profile: SEEDED_CORRIDOR_ROUTING_PROFILE,
        routingEngineVersion: SEEDED_CORRIDOR_ROUTING_ENGINE_VERSION,
      });

      expect(cached).toBeDefined();
      expect(cached?.distance).toBeCloseTo(corridor.distanceKm, 4);
      expect(cached?.routingEngineVersion).toBe(SEEDED_CORRIDOR_ROUTING_ENGINE_VERSION);
    }
  });

  it('has no cache entry for a corridor that was never seeded', async () => {
    const cache = await createSeededCorridorCache();
    const madrid = SEEDED_CITIES.find((c) => c.key === 'madrid')!;
    // Barcelona -> Valencia was never captured or added to SEEDED_CORRIDORS.
    const barcelona = SEEDED_CITIES.find((c) => c.key === 'barcelona')!;
    const valencia = SEEDED_CITIES.find((c) => c.key === 'valencia')!;
    const unseeded = await cache.get({
      origin: barcelona.coordinates,
      destination: valencia.coordinates,
      profile: SEEDED_CORRIDOR_ROUTING_PROFILE,
      routingEngineVersion: SEEDED_CORRIDOR_ROUTING_ENGINE_VERSION,
    });
    expect(unseeded).toBeUndefined();
    // Sanity: madrid itself is a known city, just not paired with barcelona/valencia here.
    expect(madrid.name).toBe('Madrid');
  });

  it('every seeded corridor references a city actually present in SEEDED_CITIES', () => {
    const keys = new Set(SEEDED_CITIES.map((c) => c.key));
    for (const corridor of SEEDED_CORRIDORS) {
      expect(keys.has(corridor.cityAKey)).toBe(true);
      expect(keys.has(corridor.cityBKey)).toBe(true);
    }
  });
});
