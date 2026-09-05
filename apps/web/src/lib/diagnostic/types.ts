/**
 * A row exactly as parsed from the uploaded file, header order unknown. Values are `unknown`,
 * not `string` — a CSV parser gives strings, but an Excel cell can come through as a native
 * number, Date, or boolean, and validation (columnMapping.ts) is where that gets normalized.
 */
export type RawRow = Readonly<Record<string, unknown>>;

export type RequiredField = 'origin' | 'destination' | 'date' | 'weightKg' | 'equipmentType';

/** Maps each field this diagnostic needs to the raw column header the user confirmed it lives in. */
export type ColumnMapping = Readonly<Record<RequiredField, string>>;

/** One row after mapping and validation — still holding the user's raw city/equipment text. */
export interface MappedShipmentRow {
  readonly rowNumber: number;
  readonly origin: string;
  readonly destination: string;
  readonly date: string;
  readonly weightKg: number;
  readonly equipmentType: string;
}

export interface RowError {
  readonly rowNumber: number;
  readonly message: string;
}
