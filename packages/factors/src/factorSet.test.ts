import { gramsCO2ePerTonneKilometre } from '@freyo/shared';
import { describe, expect, it } from 'vitest';
import { createFactorSet } from './factorSet.js';
import {
  MissingFactorError,
  type FactorSetId,
  type TransportOperationCategoryKey,
} from './types.js';

// Fictional numbers, clearly marked — never real emission data. See CLAUDE.md and
// data/README.md.
const TEST_ONLY_ID: FactorSetId = {
  source: 'TEST_ONLY',
  version: '0',
  effectiveDate: '2020-01-01',
};

const KNOWN_TOC: TransportOperationCategoryKey = {
  vehicleType: 'rigid-12t',
  fuelType: 'diesel',
  loadProfile: 'average',
  region: 'ES',
};

const UNKNOWN_TOC: TransportOperationCategoryKey = {
  vehicleType: 'articulated-40t',
  fuelType: 'diesel',
  loadProfile: 'full',
  region: 'ES',
};

function buildTestFactorSet() {
  return createFactorSet(TEST_ONLY_ID, 'TEST_ONLY-GWP', [
    {
      toc: KNOWN_TOC,
      intensity: {
        wellToTank: gramsCO2ePerTonneKilometre(11),
        tankToWheel: gramsCO2ePerTonneKilometre(89),
        wellToWheel: gramsCO2ePerTonneKilometre(100),
      },
    },
  ]);
}

describe('createFactorSet', () => {
  it('returns the intensity for a known transport operation category', () => {
    const result = buildTestFactorSet().lookup(KNOWN_TOC);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intensity.wellToWheel).toBe(100);
      expect(result.intensity.wellToTank).toBe(11);
      expect(result.intensity.tankToWheel).toBe(89);
    }
  });

  it('returns a typed MissingFactorError for an unknown category, never a fallback value', () => {
    const result = buildTestFactorSet().lookup(UNKNOWN_TOC);
    expect(result.ok).toBe(false);
    // A failed lookup carries no `intensity` field at all — there is no numeric value to
    // accidentally read as a fallback.
    expect('intensity' in result).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(MissingFactorError);
      expect(result.error.factorSetId).toEqual(TEST_ONLY_ID);
      expect(result.error.requestedToc).toEqual(UNKNOWN_TOC);
    }
  });

  it('exposes a stable composite key from (source, version, effectiveDate)', () => {
    expect(buildTestFactorSet().compositeKey).toBe('TEST_ONLY@0@2020-01-01');
  });

  it('is frozen: mutating it after construction throws rather than silently succeeding', () => {
    const factorSet = buildTestFactorSet() as unknown as Record<string, unknown>;
    expect(Object.isFrozen(factorSet)).toBe(true);
    expect(() => {
      factorSet['gwpSet'] = 'SOMETHING_ELSE';
    }).toThrow(TypeError);
  });

  it('two factor sets with different ids never share factors, even with identical TOC keys', () => {
    const other = createFactorSet(
      { source: 'TEST_ONLY', version: '1', effectiveDate: '2021-01-01' },
      'TEST_ONLY-GWP',
      [],
    );
    const result = other.lookup(KNOWN_TOC);
    expect(result.ok).toBe(false);
  });
});
