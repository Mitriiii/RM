import type {
  EmissionIntensity,
  FactorLookupResult,
  FactorSetId,
  TransportOperationCategoryKey,
} from './types.js';
import { MissingFactorError, factorSetKey, tocKeyToString } from './types.js';

export interface FactorSetEntry {
  readonly toc: TransportOperationCategoryKey;
  readonly intensity: EmissionIntensity;
}

export interface FactorSet {
  readonly id: FactorSetId;
  readonly gwpSet: string;
  readonly compositeKey: string;
  lookup(toc: TransportOperationCategoryKey): FactorLookupResult;
}

/**
 * Builds an immutable factor set from a fixed list of entries. There is no method to add or
 * replace an entry after construction — a factor set, once created, cannot drift, and the
 * only way to get a different set of factors is to construct a new one with a different
 * FactorSetId.
 */
export function createFactorSet(
  id: FactorSetId,
  gwpSet: string,
  entries: readonly FactorSetEntry[],
): FactorSet {
  const frozenId = Object.freeze({ ...id });
  const index = new Map<string, EmissionIntensity>();
  for (const entry of entries) {
    index.set(tocKeyToString(entry.toc), entry.intensity);
  }

  return Object.freeze({
    id: frozenId,
    gwpSet,
    compositeKey: factorSetKey(frozenId),
    lookup(toc: TransportOperationCategoryKey): FactorLookupResult {
      const intensity = index.get(tocKeyToString(toc));
      if (intensity === undefined) {
        return { ok: false, error: new MissingFactorError(frozenId, toc) };
      }
      return { ok: true, intensity };
    },
  });
}
