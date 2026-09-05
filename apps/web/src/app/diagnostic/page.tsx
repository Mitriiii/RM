'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Stepper } from '@/components/ui/Stepper';
import { Caption, Label, PageTitle, Prose, SectionTitle } from '@/components/ui/Typography';
import { UploadDropzone } from '@/components/ui/UploadDropzone';
import { applyColumnMapping, guessColumnMapping } from '@/lib/diagnostic/columnMapping';
import {
  DEFAULT_DIESEL_PRICE_EUR_PER_LITRE,
  DEFAULT_DIESEL_TTW_KG_CO2E_PER_LITRE,
  DEFAULT_DIESEL_WTT_KG_CO2E_PER_LITRE,
  DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM,
  ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE,
} from '@/lib/diagnostic/costs';
import type { VehicleCategory } from '@/lib/diagnostic/equipment';
import { parseShipmentFile, type ParsedFile } from '@/lib/diagnostic/parseFile';
import type { ColumnMapping, MappedShipmentRow, RequiredField } from '@/lib/diagnostic/types';
import { runDiagnostic, type RunDiagnosticResult } from './actions';
import { ExampleReportPreview } from './ExampleReportPreview';
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

const WIZARD_STEPS: readonly { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'map', label: 'Map columns' },
  { id: 'assumptions', label: 'Assumptions' },
];

export default function DiagnosticPage() {
  const [step, setStep] = useState<Step>('upload');
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [parsed, setParsed] = useState<ParsedFile | undefined>();
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});

  const [dieselPrice, setDieselPrice] = useState(DEFAULT_DIESEL_PRICE_EUR_PER_LITRE);
  const [dieselConsumption, setDieselConsumption] = useState<Record<VehicleCategory, number>>({
    ...DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM,
  });
  const [dieselWttFactor, setDieselWttFactor] = useState(DEFAULT_DIESEL_WTT_KG_CO2E_PER_LITRE);
  const [dieselTtwFactor, setDieselTtwFactor] = useState(DEFAULT_DIESEL_TTW_KG_CO2E_PER_LITRE);
  const [carbonPrices, setCarbonPrices] = useState<readonly number[]>(
    ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE,
  );

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<RunDiagnosticResult | undefined>();

  const mappingComplete = REQUIRED_FIELDS.every((field) => mapping[field]);

  // Recomputed live as the mapping changes, so validation problems show up on the
  // mapping step itself — not only after moving past it.
  const { rows: mappedRows, errors: mappingErrors } = useMemo(() => {
    if (!parsed || !mappingComplete)
      return { rows: [] as readonly MappedShipmentRow[], errors: [] };
    return applyColumnMapping(parsed.rows, mapping as ColumnMapping);
  }, [parsed, mapping, mappingComplete]);

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

  function handleRunDiagnostic() {
    startTransition(async () => {
      const diagnosticResult = await runDiagnostic({
        rows: mappedRows,
        dieselPriceEurPerLitre: dieselPrice,
        dieselConsumptionLPerKm: dieselConsumption,
        dieselWttKgCO2ePerLitre: dieselWttFactor,
        dieselTtwKgCO2ePerLitre: dieselTtwFactor,
      });
      setResult(diagnosticResult);
      if (diagnosticResult.ok) setStep('report');
    });
  }

  const previewRows = useMemo(() => parsed?.rows.slice(0, 8) ?? [], [parsed]);
  const currentStepIndex = WIZARD_STEPS.findIndex((entry) => entry.id === step);

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
          setResult(undefined);
        }}
      />
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-6 border-b border-slate-300 pb-6">
        <PageTitle>The empty-kilometre diagnostic</PageTitle>
        <Prose className="mt-2 max-w-2xl">
          Upload your shipment history and see, by lane, how many kilometres you likely paid to run
          empty — and what that costs under EU ETS2 carbon pricing.
        </Prose>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-caption text-slate-500">
          <Link href="/methodology" className="underline decoration-slate-300 underline-offset-2">
            ISO 14083 methodology
          </Link>
          <span>Every number traces to its inputs</span>
        </div>
      </header>

      <div className="mb-8 overflow-x-auto">
        <Stepper
          steps={WIZARD_STEPS.map(({ id, label }) => ({ id, label }))}
          currentIndex={currentStepIndex}
        />
      </div>

      {step === 'upload' && (
        <div className="space-y-6">
          <ExampleReportPreview />

          <section className="border border-slate-300 p-6">
            <SectionTitle>Shipment history file</SectionTitle>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 border border-slate-200 bg-slate-50 p-4 text-body sm:grid-cols-3">
              <div>
                <dt className="text-label font-medium text-slate-600">Format</dt>
                <dd className="text-slate-800">CSV or Excel (.xlsx, .xls)</dd>
              </div>
              <div>
                <dt className="text-label font-medium text-slate-600">Required columns</dt>
                <dd className="text-slate-800">
                  Origin, destination, date, weight, equipment type — any header names, any order
                </dd>
              </div>
              <div>
                <dt className="text-label font-medium text-slate-600">Coverage</dt>
                <dd className="text-slate-800">Spanish cities only, for now</dd>
              </div>
            </dl>
            <div className="mt-4">
              <UploadDropzone
                onFileSelected={(file) => void handleFileSelected(file)}
                error={uploadError}
              />
            </div>
          </section>
        </div>
      )}

      {step === 'map' && parsed && (
        <section className="border border-slate-300 p-6">
          <SectionTitle>Confirm the column mapping</SectionTitle>
          <Prose className="mt-1">
            We guessed the mapping below from your headers — check it against the preview and
            correct anything that&apos;s wrong before continuing.
          </Prose>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {REQUIRED_FIELDS.map((field) => (
              <label key={field} className="block">
                <Label>{FIELD_LABELS[field]}</Label>
                <select
                  className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1 text-body"
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

          {mappingComplete && (
            <div className="mt-4 border border-slate-200 bg-slate-50 px-3 py-2 text-caption text-slate-600">
              {mappedRows.length} row{mappedRows.length === 1 ? '' : 's'} valid
              {mappingErrors.length > 0 && (
                <>
                  {' · '}
                  <span className="text-amber-700">
                    {mappingErrors.length} row{mappingErrors.length === 1 ? '' : 's'} with problems
                  </span>
                </>
              )}
            </div>
          )}

          {mappingComplete && mappingErrors.length > 0 && (
            <details className="mt-2 border border-amber-400 bg-amber-50 p-3 text-body">
              <summary className="cursor-pointer font-medium text-amber-900">
                See which rows have problems
              </summary>
              <ul className="mt-2 space-y-1 text-caption text-amber-800">
                {mappingErrors.map((error) => (
                  <li key={error.rowNumber}>
                    Row {error.rowNumber}: {error.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  {parsed.headers.map((header) => (
                    <th
                      key={header}
                      className="whitespace-nowrap px-2 py-1 text-label font-medium text-slate-600"
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
                        className="whitespace-nowrap px-2 py-1 text-body tabular-nums text-slate-700"
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
            disabled={!mappingComplete || mappedRows.length === 0}
            onClick={() => setStep('assumptions')}
            className="mt-6 border border-slate-900 bg-slate-900 px-4 py-2 text-label font-medium text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
          >
            Continue
          </button>
        </section>
      )}

      {step === 'assumptions' && (
        <section className="border border-slate-300 p-6">
          <SectionTitle>Cost and emissions assumptions</SectionTitle>
          <Prose className="mt-1">
            None of these are audited emission factors — they&apos;re adjustable estimates for
            describing empty running. Change any of them; the report recalculates from your inputs.
          </Prose>

          <Caption className="mt-3">
            {mappedRows.length} row{mappedRows.length === 1 ? '' : 's'} ready to process.
          </Caption>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
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
              label="Diesel WTT factor (kgCO2e/L)"
              value={dieselWttFactor}
              onChange={setDieselWttFactor}
              note="Upstream fuel production and distribution — a published approximation."
            />
            <NumberField
              label="Diesel TTW factor (kgCO2e/L)"
              value={dieselTtwFactor}
              onChange={setDieselTtwFactor}
              note="Tank-to-wheel combustion — a published approximation."
            />
          </div>
          <Caption className="mt-2">
            Well-to-wheel is always well-to-tank plus tank-to-wheel — it isn&apos;t a separate
            adjustable input, so it can never drift from what these two say.
          </Caption>

          {result && !result.ok && <p className="mt-4 text-body text-red-700">{result.message}</p>}

          <button
            type="button"
            disabled={mappedRows.length === 0 || isPending}
            onClick={handleRunDiagnostic}
            className="mt-6 border border-slate-900 bg-slate-900 px-4 py-2 text-label font-medium text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
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
    <label className="block">
      <Label>{label}</Label>
      <input
        type="number"
        step="0.01"
        className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1 text-body tabular-nums"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <Caption className="mt-1">{note}</Caption>
    </label>
  );
}
