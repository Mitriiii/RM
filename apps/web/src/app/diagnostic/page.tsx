'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  DEFAULT_DIESEL_PRICE_EUR_PER_LITRE,
  DEFAULT_DIESEL_WTW_KG_CO2E_PER_LITRE,
  DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM,
  ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE,
} from '@/lib/diagnostic/costs';
import { applyColumnMapping, guessColumnMapping } from '@/lib/diagnostic/columnMapping';
import type { VehicleCategory } from '@/lib/diagnostic/equipment';
import { parseShipmentFile, type ParsedFile } from '@/lib/diagnostic/parseFile';
import type {
  ColumnMapping,
  MappedShipmentRow,
  RequiredField,
  RowError,
} from '@/lib/diagnostic/types';
import { runDiagnostic, type RunDiagnosticResult } from './actions';
import { ReportView } from './ReportView';

type Step = 'upload' | 'map' | 'assumptions' | 'report';

const FIELD_LABELS: Record<RequiredField, string> = {
  origin: 'Origin city',
  destination: 'Destination city',
  date: 'Date',
  weightKg: 'Weight (kg)',
  equipmentType: 'Equipment type',
};

const REQUIRED_FIELDS: readonly RequiredField[] = [
  'origin',
  'destination',
  'date',
  'weightKg',
  'equipmentType',
];

const WIZARD_STEPS: readonly { step: Step; label: string }[] = [
  { step: 'upload', label: 'Upload' },
  { step: 'map', label: 'Map columns' },
  { step: 'assumptions', label: 'Assumptions' },
];

export default function DiagnosticPage() {
  const [step, setStep] = useState<Step>('upload');
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [parsed, setParsed] = useState<ParsedFile | undefined>();
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [mappedRows, setMappedRows] = useState<readonly MappedShipmentRow[]>([]);
  const [mappingErrors, setMappingErrors] = useState<readonly RowError[]>([]);

  const [dieselPrice, setDieselPrice] = useState(DEFAULT_DIESEL_PRICE_EUR_PER_LITRE);
  const [dieselConsumption, setDieselConsumption] = useState<Record<VehicleCategory, number>>({
    ...DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM,
  });
  const [dieselWtwFactor, setDieselWtwFactor] = useState(DEFAULT_DIESEL_WTW_KG_CO2E_PER_LITRE);
  const [carbonPrices, setCarbonPrices] = useState<readonly number[]>(
    ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE,
  );

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<RunDiagnosticResult | undefined>();

  const mappingComplete = REQUIRED_FIELDS.every((field) => mapping[field]);

  async function handleFileSelected(file: File) {
    setUploadError(undefined);
    try {
      const parsedFile = await parseShipmentFile(file);
      if (parsedFile.rows.length === 0) {
        setUploadError('The file has no data rows.');
        return;
      }
      setParsed(parsedFile);
      setMapping(guessColumnMapping(parsedFile.headers));
      setStep('map');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not read that file.');
    }
  }

  function handleConfirmMapping() {
    if (!parsed || !mappingComplete) return;
    const { rows, errors } = applyColumnMapping(parsed.rows, mapping as ColumnMapping);
    setMappedRows(rows);
    setMappingErrors(errors);
    setStep('assumptions');
  }

  function handleRunDiagnostic() {
    startTransition(async () => {
      const diagnosticResult = await runDiagnostic({
        rows: mappedRows,
        dieselPriceEurPerLitre: dieselPrice,
        dieselConsumptionLPerKm: dieselConsumption,
        dieselWtwKgCO2ePerLitre: dieselWtwFactor,
      });
      setResult(diagnosticResult);
      if (diagnosticResult.ok) setStep('report');
    });
  }

  const previewRows = useMemo(() => parsed?.rows.slice(0, 8) ?? [], [parsed]);

  if (step === 'report' && result?.ok) {
    return (
      <ReportView
        report={result.report}
        carbonPrices={carbonPrices}
        onCarbonPricesChange={setCarbonPrices}
        onStartOver={() => {
          setStep('upload');
          setParsed(undefined);
          setMapping({});
          setMappedRows([]);
          setMappingErrors([]);
          setResult(undefined);
        }}
      />
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 border-b border-slate-300 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">The empty-kilometre diagnostic</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Upload your shipment history and see, by lane, how many kilometres you likely paid to run
          empty — and what that costs under EU ETS2 carbon pricing.
        </p>
      </header>

      <ol className="mb-8 flex gap-6 text-sm">
        {WIZARD_STEPS.map(({ step: s, label }, i) => (
          <li
            key={s}
            className={
              step === s
                ? 'font-semibold text-slate-900'
                : WIZARD_STEPS.findIndex((entry) => entry.step === step) > i
                  ? 'text-slate-500'
                  : 'text-slate-400'
            }
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 'upload' && (
        <section className="border border-slate-300 p-6">
          <label className="block text-sm font-medium text-slate-900">Shipment history file</label>
          <p className="mt-1 text-xs text-slate-600">
            CSV or Excel, with columns for origin city, destination city, date, weight, and
            equipment type — any header names, any order. Currently supports Spanish cities only;
            see the list after upload if a city doesn&apos;t resolve.
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="mt-4 block text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />
          {uploadError && <p className="mt-3 text-sm text-red-700">{uploadError}</p>}
        </section>
      )}

      {step === 'map' && parsed && (
        <section className="border border-slate-300 p-6">
          <h2 className="text-sm font-semibold text-slate-900">Confirm the column mapping</h2>
          <p className="mt-1 text-xs text-slate-600">
            We guessed the mapping below from your headers — check it against the preview and
            correct anything that&apos;s wrong before continuing.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {REQUIRED_FIELDS.map((field) => (
              <label key={field} className="block text-xs">
                <span className="font-medium text-slate-900">{FIELD_LABELS[field]}</span>
                <select
                  className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1 text-sm"
                  value={mapping[field] ?? ''}
                  onChange={(event) =>
                    setMapping((prev) => ({ ...prev, [field]: event.target.value || undefined }))
                  }
                >
                  <option value="">— select column —</option>
                  {parsed.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  {parsed.headers.map((header) => (
                    <th
                      key={header}
                      className="whitespace-nowrap px-2 py-1 font-medium text-slate-600"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    {parsed.headers.map((header) => (
                      <td
                        key={header}
                        className="whitespace-nowrap px-2 py-1 tabular-nums text-slate-700"
                      >
                        {String(row[header] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={!mappingComplete}
            onClick={handleConfirmMapping}
            className="mt-6 border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
          >
            Continue
          </button>
        </section>
      )}

      {step === 'assumptions' && (
        <section className="border border-slate-300 p-6">
          <h2 className="text-sm font-semibold text-slate-900">Cost and emissions assumptions</h2>
          <p className="mt-1 text-xs text-slate-600">
            None of these are audited emission factors — they&apos;re adjustable estimates for
            describing empty running. Change any of them; the report recalculates from your inputs.
          </p>

          {mappingErrors.length > 0 && (
            <details className="mt-4 border border-amber-400 bg-amber-50 p-3 text-xs">
              <summary className="cursor-pointer font-medium text-amber-900">
                {mappingErrors.length} row{mappingErrors.length === 1 ? '' : 's'} could not be read
                and will be excluded
              </summary>
              <ul className="mt-2 space-y-1 text-amber-800">
                {mappingErrors.map((error) => (
                  <li key={error.rowNumber}>
                    Row {error.rowNumber}: {error.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="mt-3 text-xs text-slate-600">
            {mappedRows.length} row{mappedRows.length === 1 ? '' : 's'} ready to process.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NumberField
              label="Diesel price (€/L)"
              value={dieselPrice}
              onChange={setDieselPrice}
              note="Representative Spanish pump price — check the current price."
            />
            <NumberField
              label="Rigid truck: L/km empty"
              value={dieselConsumption.rigid}
              onChange={(value) => setDieselConsumption((prev) => ({ ...prev, rigid: value }))}
              note="Typical unladen consumption; adjust for your fleet."
            />
            <NumberField
              label="Articulated truck: L/km empty"
              value={dieselConsumption.articulated}
              onChange={(value) =>
                setDieselConsumption((prev) => ({ ...prev, articulated: value }))
              }
              note="Typical unladen consumption; adjust for your fleet."
            />
            <NumberField
              label="Diesel WTW factor (kgCO2e/L)"
              value={dieselWtwFactor}
              onChange={setDieselWtwFactor}
              note="Combustion + upstream production; a published approximation."
            />
          </div>

          {result && !result.ok && <p className="mt-4 text-sm text-red-700">{result.message}</p>}

          <button
            type="button"
            disabled={mappedRows.length === 0 || isPending}
            onClick={handleRunDiagnostic}
            className="mt-6 border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
          >
            {isPending ? 'Routing every lane…' : 'Run diagnostic'}
          </button>
        </section>
      )}
    </main>
  );
}

function NumberField({
  label,
  value,
  onChange,
  note,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  note: string;
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-slate-900">{label}</span>
      <input
        type="number"
        step="0.01"
        className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1 text-sm tabular-nums"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="mt-1 block text-slate-500">{note}</span>
    </label>
  );
}
