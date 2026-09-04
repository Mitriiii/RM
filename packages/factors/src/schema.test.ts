import { describe, expect, it } from 'vitest';
import { factorSetFileSchema } from './schema.js';

// Fictional numbers, clearly marked — never real emission data. See CLAUDE.md and
// data/README.md.
const validFile = {
  id: { source: 'TEST_ONLY', version: '0', effectiveDate: '2020-01-01' },
  gwpSet: 'TEST_ONLY-GWP',
  factors: [
    {
      toc: { vehicleType: 'rigid-12t', fuelType: 'diesel', loadProfile: 'average', region: 'ES' },
      wellToTankGramsPerTonneKm: 11,
      tankToWheelGramsPerTonneKm: 89,
      wellToWheelGramsPerTonneKm: 100,
    },
  ],
};

describe('factorSetFileSchema', () => {
  it('accepts a well-formed factor set file', () => {
    expect(() => factorSetFileSchema.parse(validFile)).not.toThrow();
  });

  it('rejects a file with no factors', () => {
    expect(() => factorSetFileSchema.parse({ ...validFile, factors: [] })).toThrow();
  });

  it('rejects a negative emission intensity', () => {
    const invalid = {
      ...validFile,
      factors: [{ ...validFile.factors[0], wellToTankGramsPerTonneKm: -1 }],
    };
    expect(() => factorSetFileSchema.parse(invalid)).toThrow();
  });

  it('rejects wellToWheel that does not equal wellToTank + tankToWheel', () => {
    const invalid = {
      ...validFile,
      factors: [{ ...validFile.factors[0], wellToWheelGramsPerTonneKm: 500 }],
    };
    expect(() => factorSetFileSchema.parse(invalid)).toThrow();
  });

  it('rejects an effectiveDate that is not an ISO date', () => {
    const invalid = { ...validFile, id: { ...validFile.id, effectiveDate: 'not-a-date' } };
    expect(() => factorSetFileSchema.parse(invalid)).toThrow();
  });

  it('rejects a missing source, version, or TOC field', () => {
    const { source: _source, ...idWithoutSource } = validFile.id;
    expect(() => factorSetFileSchema.parse({ ...validFile, id: idWithoutSource })).toThrow();
  });
});
