'use client';

import { Fragment, useState } from 'react';
import { ets2CostEur } from '@/lib/diagnostic/costs';
import type { DiagnosticReport, LaneReportRow } from '@/lib/diagnostic/report';
import { gramsCO2e } from '@freyo/shared';

interface ReportViewProps {
  readonly report: DiagnosticReport;
  readonly carbonPrices: readonly number[];
  readonly onCarbonPricesChange: (prices: readonly number[]) => void;
  readonly onStartOver: () => void;
}

function formatNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatDirection(lane: LaneReportRow): string {
  if (lane.emptyDirection === 'balanced') return '—';
  const emptyCity = lane.emptyDirection === 'AtoB' ? lane.cityA : lane.cityB;
  const loadedCity = lane.emptyDirection === 'AtoB' ? lane.cityB : lane.cityA;
  return `→ ${emptyCity} (from ${loadedCity})`;
}

export function ReportView({
  report,
  carbonPrices,
  onCarbonPricesChange,
  onStartOver,
}: ReportViewProps) {
  const [expandedLane, setExpandedLane] = useState<string | undefined>();
  const [customPriceInput, setCustomPriceInput] = useState('');

  const totalCO2e = gramsCO2e(report.totalEmptyCO2eGrams);
  const totalCO2eTonnes = report.totalEmptyCO2eGrams / 1_000_000;

  function addCustomPrice() {
    const price = Number(customPriceInput);
    if (Number.isFinite(price) && price >= 0 && !carbonPrices.includes(price)) {
      onCarbonPricesChange([...carbonPrices, price].sort((a, b) => a - b));
    }
    setCustomPriceInput('');
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 print:max-w-none print:px-0 print:py-4">
      <div className="mb-6 flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empty-kilometre diagnostic</h1>
          <p className="mt-1 text-sm text-slate-600">
            Routing engine: {report.routingEngineVersion ?? 'n/a'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="border border-slate-300 px-3 py-1.5 text-sm"
          >
            Start over
          </button>
        </div>
      </div>

      <div className="mb-8 border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">
        These figures are a diagnostic estimate, not an audited emissions record. Distances use the
        <span className="font-medium"> car</span> routing profile — no truck profile ships with the
        underlying routing engine, so distances are not truck-accurate. Empty-leg diesel cost and
        CO2e use the adjustable fuel-based assumptions from the previous step, not an ISO 14083
        calculation.
      </div>

      <section className="mb-8 grid grid-cols-3 border border-slate-300 text-sm">
        <Stat label="Probable empty distance" value={`${formatNumber(report.totalEmptyKm)} km`} />
        <Stat
          label="Diesel cost of empty running"
          value={`€${formatNumber(report.totalEmptyDieselCostEur)}`}
        />
        <Stat label="CO2e of empty running" value={`${formatNumber(totalCO2eTonnes, 3)} t`} last />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Empty running by lane</h2>
        {report.lanes.length === 0 ? (
          <p className="text-sm text-slate-600">
            No probable empty legs found — every lane in this file is directionally balanced.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-400 text-left">
                  <th className="px-2 py-1.5 font-medium text-slate-600">Lane</th>
                  <th className="px-2 py-1.5 font-medium text-slate-600">Trips A→B / B→A</th>
                  <th className="px-2 py-1.5 font-medium text-slate-600">Presumed empty</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">Distance</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">Empty km</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">Diesel cost</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">CO2e</th>
                </tr>
              </thead>
              <tbody>
                {report.lanes.map((lane) => {
                  const key = `${lane.cityA}|${lane.cityB}`;
                  const expanded = expandedLane === key;
                  return (
                    <Fragment key={key}>
                      <tr
                        className="cursor-pointer border-b border-slate-200 hover:bg-slate-50"
                        onClick={() => setExpandedLane(expanded ? undefined : key)}
                      >
                        <td className="px-2 py-1.5 capitalize text-slate-900">
                          {lane.cityA} ↔ {lane.cityB}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-slate-700">
                          {lane.tripsAtoB} / {lane.tripsBtoA}
                        </td>
                        <td className="px-2 py-1.5 text-slate-700">{formatDirection(lane)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                          {formatNumber(lane.distanceKm)} km
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium text-slate-900">
                          {formatNumber(lane.emptyKm)} km
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-900">
                          €{formatNumber(lane.emptyDieselCostEur)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-900">
                          {formatNumber(lane.emptyCO2eGrams / 1_000, 1)} kg
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <td colSpan={7} className="px-3 py-3 text-slate-700">
                            <LaneDerivation lane={lane} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">EU ETS2 cost scenarios</h2>
        <p className="mb-2 text-xs text-slate-600">
          ETS2 applies a carbon price to road transport fuel from 1 January 2028. Pre-delay
          projections ran roughly €40–63 per tonne CO2e (ICAP / EEA / Transport &amp; Environment);
          €0 is included to show the cost case without a carbon price at all, since the date has
          already slipped once.
        </p>
        <table className="w-full max-w-md border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-400 text-left">
              <th className="px-2 py-1.5 font-medium text-slate-600">Carbon price</th>
              <th className="px-2 py-1.5 text-right font-medium text-slate-600">Added cost</th>
            </tr>
          </thead>
          <tbody>
            {carbonPrices.map((price) => (
              <tr key={price} className="border-b border-slate-200">
                <td className="px-2 py-1.5 tabular-nums text-slate-700">
                  €{formatNumber(price)}/t
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium text-slate-900">
                  €{formatNumber(ets2CostEur(totalCO2e, price))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex items-center gap-2 print:hidden">
          <input
            type="number"
            placeholder="Custom price (€/t)"
            value={customPriceInput}
            onChange={(event) => setCustomPriceInput(event.target.value)}
            className="w-40 border border-slate-300 px-2 py-1 text-xs tabular-nums"
          />
          <button
            type="button"
            onClick={addCustomPrice}
            className="border border-slate-300 px-2 py-1 text-xs"
          >
            Add scenario
          </button>
        </div>
      </section>

      {report.issues.length > 0 && (
        <section className="mb-8 print:hidden">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            {report.issues.length} row{report.issues.length === 1 ? '' : 's'} excluded
          </h2>
          <ul className="space-y-1 text-xs text-slate-600">
            {report.issues.map((issue) => (
              <li key={issue.rowNumber}>
                Row {issue.rowNumber}: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`p-4 ${last ? '' : 'border-r border-slate-300'}`}>
      <div className="text-xs text-slate-600">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function LaneDerivation({ lane }: { lane: LaneReportRow }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
      <DerivationItem
        label="Empty km"
        formula={`${formatNumber(lane.distanceKm, 1)} km × ${lane.probableEmptyTrips} trips`}
        value={`${formatNumber(lane.emptyKm)} km`}
      />
      <DerivationItem
        label="Diesel cost"
        formula={`${formatNumber(lane.emptyKm)} km × consumption × price`}
        value={`€${formatNumber(lane.emptyDieselCostEur)}`}
      />
      <DerivationItem
        label="CO2e"
        formula={`${formatNumber(lane.emptyKm)} km × consumption × WTW factor`}
        value={`${formatNumber(lane.emptyCO2eGrams / 1_000, 1)} kg`}
      />
      <DerivationItem
        label="Assumed vehicle"
        formula="majority equipment type on this lane"
        value={lane.assumedVehicleCategory}
      />
    </dl>
  );
}

function DerivationItem({
  label,
  formula,
  value,
}: {
  label: string;
  formula: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular-nums text-slate-900">{value}</dd>
      <dd className="text-slate-400">{formula}</dd>
    </div>
  );
}
