import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadFactorSetFromFile } from './loader.js';
import { resolveFactorDataPath } from './paths.js';

describe('resolveFactorDataPath', () => {
  it("resolves to a real, existing file under this package's data directory", () => {
    const path = resolveFactorDataPath(
      'uk-desnz-ghg-conversion-factors/2026-flat-file-v1.2/factors.json',
    );
    expect(existsSync(path)).toBe(true);
  });

  it('resolves a path that loadFactorSetFromFile can actually load', () => {
    const path = resolveFactorDataPath(
      'uk-desnz-ghg-conversion-factors/2026-flat-file-v1.2/factors.json',
    );
    const factorSet = loadFactorSetFromFile(path);
    expect(factorSet.id.source).toBe('uk-desnz-ghg-conversion-factors');
    expect(factorSet.list().length).toBeGreaterThan(0);
  });
});
