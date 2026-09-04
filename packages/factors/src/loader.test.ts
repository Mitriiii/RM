import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadFactorSetFromFile } from './loader.js';

const fixture = (name: string): string =>
  fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));

describe('loadFactorSetFromFile', () => {
  it('loads a valid TEST_ONLY factor set file and can look up its factors', () => {
    const factorSet = loadFactorSetFromFile(fixture('test-only-factor-set.json'));
    expect(factorSet.compositeKey).toBe('TEST_ONLY@0@2020-01-01');
    expect(factorSet.gwpSet).toBe('TEST_ONLY-GWP');

    const result = factorSet.lookup({
      vehicleType: 'rigid-12t',
      fuelType: 'diesel',
      loadProfile: 'average',
      region: 'ES',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intensity.wellToWheel).toBe(100);
    }
  });

  it('throws on a file with no factors rather than loading an empty, unusable set', () => {
    expect(() => loadFactorSetFromFile(fixture('malformed-factor-set.json'))).toThrow();
  });

  it('throws on a nonexistent file rather than returning an empty factor set', () => {
    expect(() => loadFactorSetFromFile(fixture('does-not-exist.json'))).toThrow();
  });
});
