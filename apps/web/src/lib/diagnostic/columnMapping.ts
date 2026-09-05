import { z } from 'zod';
import type { ColumnMapping, MappedShipmentRow, RawRow, RequiredField, RowError } from './types';

/**
 * Keyword hints for guessing which raw column header corresponds to each required field.
 * This is only ever a starting suggestion — CLAUDE.md's "real files are messy" is exactly
 * why the UI always shows the guess back to the user for confirmation before anything is
 * computed from it, rather than trusting a guess silently.
 */
const FIELD_HINTS: Readonly<Record<RequiredField, readonly string[]>> = {
  origin: ['origin', 'from', 'pickup', 'source', 'origen'],
  destination: ['destination', 'to', 'delivery', 'dest', 'destino'],
  date: ['date', 'fecha', 'day', 'shipped'],
  weightKg: ['weight', 'mass', 'kg', 'peso'],
  equipmentType: ['equipment', 'vehicle', 'truck', 'unit type', 'vehiculo'],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

/**
 * Best-effort guess at a column mapping from the raw file's headers. Never guaranteed
 * complete — a field with no confident match is simply absent from the result, and the UI
 * must ask the user to pick it manually.
 */
export function guessColumnMapping(headers: readonly string[]): Partial<ColumnMapping> {
  const guess: Partial<Record<RequiredField, string>> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const [field, hints] of Object.entries(FIELD_HINTS) as [
      RequiredField,
      readonly string[],
    ][]) {
      if (field in guess) continue;
      if (hints.some((hint) => normalized.includes(hint))) {
        guess[field] = header;
      }
    }
  }
  return guess;
}

/**
 * Normalizes a date cell to an ISO string before validation. An Excel cell can arrive as a
 * native JS Date (when the workbook is read with cellDates: true — see parseFile.ts) or,
 * for an older/differently-produced file, as a bare Excel serial-date number (days since
 * 1899-12-30, with Excel's well-known but harmless leap-year-1900 off-by-one baked in). A
 * CSV cell arrives as a plain string. Anything else is left alone and will fail the
 * following date-parse check rather than being silently coerced into a wrong date.
 */
function normalizeDateCell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);
    const MS_PER_DAY = 86_400_000;
    return new Date(EXCEL_EPOCH_UTC_MS + value * MS_PER_DAY).toISOString();
  }
  return value;
}

const mappedRowSchema = z.object({
  origin: z.coerce.string().trim().min(1, 'origin is empty'),
  destination: z.coerce.string().trim().min(1, 'destination is empty'),
  date: z.preprocess(
    normalizeDateCell,
    z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'date is not a recognizable date',
    }),
  ),
  weightKg: z.coerce.number().finite().positive('weight must be a positive number'),
  equipmentType: z.coerce.string().trim().min(1, 'equipment type is empty'),
});

/**
 * Applies a confirmed column mapping to every raw row, validating as it goes. Never throws
 * on a bad row — real shipment histories have typos and gaps, so every row is checked
 * independently and reported back, valid rows separated from the ones that need fixing.
 */
export function applyColumnMapping(
  rawRows: readonly RawRow[],
  mapping: ColumnMapping,
): { readonly rows: readonly MappedShipmentRow[]; readonly errors: readonly RowError[] } {
  const rows: MappedShipmentRow[] = [];
  const errors: RowError[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 1;
    const candidate = {
      origin: rawRow[mapping.origin],
      destination: rawRow[mapping.destination],
      date: rawRow[mapping.date],
      weightKg: rawRow[mapping.weightKg],
      equipmentType: rawRow[mapping.equipmentType],
    };

    const result = mappedRowSchema.safeParse(candidate);
    if (!result.success) {
      errors.push({
        rowNumber,
        message: result.error.issues.map((issue) => issue.message).join('; '),
      });
      return;
    }
    rows.push({ rowNumber, ...result.data });
  });

  return { rows, errors };
}
