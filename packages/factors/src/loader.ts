import { readFileSync } from 'node:fs';
import { gramsCO2ePerTonneKilometre } from '@freyo/shared';
import { createFactorSet, type FactorSet, type FactorSetEntry } from './factorSet.js';
import { factorSetFileSchema } from './schema.js';

/**
 * Reads and validates one versioned factor-set JSON file. Throws (a ZodError, or a JSON
 * parse error) on anything malformed rather than loading a partial or best-guess set — see
 * CLAUDE.md's "never invent an emission factor".
 */
export function loadFactorSetFromFile(filePath: string): FactorSet {
  const raw: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
  const parsed = factorSetFileSchema.parse(raw);

  const entries: FactorSetEntry[] = parsed.factors.map((factor) => ({
    toc: factor.toc,
    intensity: {
      wellToTank: gramsCO2ePerTonneKilometre(factor.wellToTankGramsPerTonneKm),
      tankToWheel: gramsCO2ePerTonneKilometre(factor.tankToWheelGramsPerTonneKm),
      wellToWheel: gramsCO2ePerTonneKilometre(factor.wellToWheelGramsPerTonneKm),
    },
  }));

  return createFactorSet(parsed.id, parsed.gwpSet, entries);
}
