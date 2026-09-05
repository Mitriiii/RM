import { describe, expect, it } from 'vitest';
import { resolveCity } from './gazetteer';

describe('resolveCity', () => {
  it('resolves a known city, case- and whitespace-insensitively', () => {
    const result = resolveCity('  Madrid  ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.coordinates.latitude).toBeCloseTo(40.4168, 2);
      expect(result.coordinates.longitude).toBeCloseTo(-3.7038, 2);
    }
  });

  it('resolves a known city regardless of accent marks', () => {
    const result = resolveCity('Malaga');
    expect(result.ok).toBe(true);
  });

  it('reports an unknown city as a failure, never a guessed coordinate', () => {
    const result = resolveCity('Atlantis');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.city).toBe('Atlantis');
    }
  });
});
