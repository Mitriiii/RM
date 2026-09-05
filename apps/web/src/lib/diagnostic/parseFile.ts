import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { RawRow } from './types';

export interface ParsedFile {
  readonly headers: readonly string[];
  readonly rows: readonly RawRow[];
}

export class UnsupportedFileTypeError extends Error {
  constructor(fileName: string) {
    super(`Unsupported file type: "${fileName}". Upload a .csv or .xlsx file.`);
    this.name = 'UnsupportedFileTypeError';
  }
}

export async function parseShipmentFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    return parseCsv(file);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseExcel(file);
  }
  throw new UnsupportedFileTypeError(file.name);
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const result = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
  return { headers: result.meta.fields ?? [], rows: result.data };
}

async function parseExcel(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('The workbook has no sheets.');

  const sheet = workbook.Sheets[firstSheetName];
  const rows = sheet ? XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' }) : [];
  const headers = rows.length > 0 ? Object.keys(rows[0] as object) : [];
  return { headers, rows };
}
