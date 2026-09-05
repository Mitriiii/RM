import { describe, expect, it } from 'vitest';
import { applyColumnMapping, guessColumnMapping } from './columnMapping';
import type { ColumnMapping, RawRow } from './types';

describe('guessColumnMapping', () => {
  it('matches common header synonyms to the right field', () => {
    const guess = guessColumnMapping([
      'Origin City',
      'Destination',
      'Ship Date',
      'Weight (kg)',
      'Vehicle Type',
    ]);
    expect(guess.origin).toBe('Origin City');
    expect(guess.destination).toBe('Destination');
    expect(guess.date).toBe('Ship Date');
    expect(guess.weightKg).toBe('Weight (kg)');
    expect(guess.equipmentType).toBe('Vehicle Type');
  });

  it('leaves a field unmapped rather than guessing when nothing matches', () => {
    const guess = guessColumnMapping(['Column A', 'Column B']);
    expect(guess.origin).toBeUndefined();
  });
});

const MAPPING: ColumnMapping = {
  origin: 'From',
  destination: 'To',
  date: 'Date',
  weightKg: 'Weight',
  equipmentType: 'Equipment',
};

describe('applyColumnMapping', () => {
  it('produces a valid mapped row from a well-formed raw row', () => {
    const raw: RawRow[] = [
      {
        From: 'Madrid',
        To: 'Zaragoza',
        Date: '2026-01-15',
        Weight: '8000',
        Equipment: 'Rigid 12t',
      },
    ];
    const { rows, errors } = applyColumnMapping(raw, MAPPING);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 1,
      origin: 'Madrid',
      destination: 'Zaragoza',
      weightKg: 8000,
      equipmentType: 'Rigid 12t',
    });
  });

  it('reports a row with a negative or zero weight as an error, not a silently accepted row', () => {
    const raw: RawRow[] = [
      { From: 'Madrid', To: 'Zaragoza', Date: '2026-01-15', Weight: '0', Equipment: 'Rigid' },
    ];
    const { rows, errors } = applyColumnMapping(raw, MAPPING);
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.rowNumber).toBe(1);
  });

  it('reports a row with an unparseable date as an error', () => {
    const raw: RawRow[] = [
      { From: 'Madrid', To: 'Zaragoza', Date: 'not a date', Weight: '8000', Equipment: 'Rigid' },
    ];
    const { errors } = applyColumnMapping(raw, MAPPING);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/date/i);
  });

  it('accepts a native JS Date value for the date column (as an Excel cell would provide)', () => {
    const raw: RawRow[] = [
      {
        From: 'Madrid',
        To: 'Zaragoza',
        Date: new Date('2026-01-15'),
        Weight: 8000,
        Equipment: 'Rigid',
      },
    ];
    const { rows, errors } = applyColumnMapping(raw, MAPPING);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it('accepts an Excel serial-date number for the date column', () => {
    // 46037 = 2026-01-15 as an Excel serial date (days since 1899-12-30).
    const raw: RawRow[] = [
      { From: 'Madrid', To: 'Zaragoza', Date: 46_037, Weight: 8000, Equipment: 'Rigid' },
    ];
    const { rows, errors } = applyColumnMapping(raw, MAPPING);
    expect(errors).toEqual([]);
    expect(rows[0]?.date).toContain('2026-01-15');
  });

  it('validates every row independently — one bad row does not block the rest', () => {
    const raw: RawRow[] = [
      { From: 'Madrid', To: 'Zaragoza', Date: '2026-01-15', Weight: '8000', Equipment: 'Rigid' },
      { From: '', To: 'Zaragoza', Date: '2026-01-15', Weight: '8000', Equipment: 'Rigid' },
      {
        From: 'Valencia',
        To: 'Barcelona',
        Date: '2026-01-16',
        Weight: '5000',
        Equipment: 'Articulated',
      },
    ];
    const { rows, errors } = applyColumnMapping(raw, MAPPING);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.rowNumber)).toEqual([1, 3]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.rowNumber).toBe(2);
  });
});
