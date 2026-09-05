'use client';

import { Fragment, useMemo, useState } from 'react';
import { DataQualityBadge } from '@/components/ui/DataQualityBadge';
import { Caption, DataValue, Label, PageTitle, SectionTitle } from '@/components/ui/Typography';
import { ets2CostEur, ETS2_PRICE_CONTAINMENT_ANCHOR_EUR_PER_TONNE } from '@/lib/diagnostic/costs';
import type { DiagnosticReport, LaneReportRow } from '@/lib/diagnostic/report';

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

type SortKey =
  'movementsObserved' | 'distanceKm' | 'emptyKm' | 'emptyDieselCostEur' | 'wellToWheelGrams';

export function ReportView({
  report,
  carbonPrices,
  onCarbonPricesChange,
  onStartOver,
}: ReportViewProps) {
  const [expandedLane, setExpandedLane] = useState<string | undefined>();
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'emptyKm',
    direction: 'desc',
  });

  const totalCO2e = report.totalWellToWheelGrams;
  const totalCO2eTonnes = totalCO2e / 1_000_000;
  const anchorExposureEur = ets2CostEur(totalCO2e, ETS2_PRICE_CONTAINMENT_ANCHOR_EUR_PER_TONNE);

  const sortedLanes = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...report.lanes].sort((a, b) => factor * (a[sort.key] - b[sort.key]));
  }, [report.lanes, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' }
        : { key, direction: 'desc' },
    );
  }

  function addCustomPrice() {
    const price = Number(customPriceInput);
    if (Number.isFinite(price) && price >= 0 && !carbonPrices.includes(price)) {
      onCarbonPricesChange([...carbonPrices, price].sort((a, b) => a - b));
    }
    setCustomPriceInput('');
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 print:max-w-none print:px-0 print:py-4">
      <div className="mb-6 flex items-start justify-between print:hidden">
        <div>
          <PageTitle>Empty-kilometre diagnostic</PageTitle>
          <Caption className="mt-1">Routing engine: {report.routingEngineVersion ?? 'n/a'}</Caption>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="border border-slate-900 bg-slate-900 px-3 py-1.5 text-label font-medium text-white"
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="border border-slate-300 px-3 py-1.5 text-label"
          >
            Start over
          </button>
        </div>
      </div>

      <div className="mb-6 border border-amber-400 bg-amber-50 p-3 text-caption text-amber-900">
        These figures are a diagnostic estimate, not an audited emissions record. Distances use the{' '}
        <span className="font-medium">car</span> routing profile — no truck profile ships with the
        underlying routing engine, so distances are not truck-accurate. Empty-leg diesel cost and
        CO2e use the adjustable fuel-based assumptions from the previous step, not an ISO 14083
        calculation.
      </div>

      {/* A dense summary row, not a hero stat grid — CLAUDE.md forbids "a big number over a
          small caption" as the primary layout; the lane table below is the actual hero. */}
      <section className="mb-6 flex flex-wrap gap-x-8 gap-y-2 border border-slate-300 bg-slate-50 px-4 py-3">
        <SummaryItem label="Lanes with probable empty legs" value={String(report.lanes.length)} />
        <SummaryItem
          label="Probable empty distance"
          value={`${formatNumber(report.totalEmptyKm)} km`}
        />
        <SummaryItem
          label="Diesel cost"
          value={`€${formatNumber(report.totalEmptyDieselCostEur)}`}
        />
        <SummaryItem label="CO2e (WTW)" value={`${formatNumber(totalCO2eTonnes, 3)} t`} />
      </section>

      <p className="mb-8 text-body text-slate-700">
        At the ETS2 price-containment reference of{' '}
        <DataValue className="text-body">
          €{ETS2_PRICE_CONTAINMENT_ANCHOR_EUR_PER_TONNE}/tCO2e
        </DataValue>
        , these empty legs represent approximately{' '}
        <DataValue className="text-body font-medium">€{formatNumber(anchorExposureEur)}</DataValue>{' '}
        in exposure once ETS2 allowance costs apply to road transport fuel from{' '}
        <span className="font-medium">1 January 2028</span>. €45/tCO2e is the level at which ETS2
        releases extra allowances if prices rise too quickly in its first two years — the closest
        thing to an official anchor price this market has; see the scenario table below for other
        carbon prices.
      </p>

      {report.insufficientDataLanes.length > 0 && (
        <section className="mb-8 border border-slate-200 bg-slate-50 p-4 print:hidden">
          <Label>{report.insufficientDataLanes.length} lane(s) with insufficient history</Label>
          <Caption className="mt-1">
            Fewer than two movements were recorded on these lanes — not enough to infer an
            empty-return pattern from, so no empty legs are estimated for them.
          </Caption>
          <ul className="mt-2 space-y-0.5 text-caption text-slate-600">
            {report.insufficientDataLanes.map((lane) => (
              <li key={`${lane.cityA}|${lane.cityB}`}>
                {lane.cityA} ↔ {lane.cityB}: {lane.movementsObserved} movement
                {lane.movementsObserved === 1 ? '' : 's'} observed
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <SectionTitle>Empty running by lane</SectionTitle>
        {report.lanes.length === 0 ? (
          <p className="mt-2 text-body text-slate-600">
            No probable empty legs found — every lane in this file is directionally balanced.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-400 text-left">
                  <Th>Lane</Th>
                  <SortableTh sortKey="movementsObserved" sort={sort} onSort={toggleSort}>
                    Movements
                  </SortableTh>
                  <Th>Trips A→B / B→A</Th>
                  <Th>Presumed empty</Th>
                  <SortableTh sortKey="distanceKm" sort={sort} onSort={toggleSort} align="right">
                    Distance
                  </SortableTh>
                  <SortableTh sortKey="emptyKm" sort={sort} onSort={toggleSort} align="right">
                    Empty km
                  </SortableTh>
                  <SortableTh
                    sortKey="emptyDieselCostEur"
                    sort={sort}
                    onSort={toggleSort}
                    align="right"
                  >
                    Diesel cost
                  </SortableTh>
                  <Th align="right">WTT</Th>
                  <Th align="right">TTW</Th>
                  <SortableTh
                    sortKey="wellToWheelGrams"
                    sort={sort}
                    onSort={toggleSort}
                    align="right"
                  >
                    WTW
                  </SortableTh>
                  <Th>Confidence</Th>
                </tr>
              </thead>
              <tbody>
                {sortedLanes.map((lane) => {
                  const key = `${lane.cityA}|${lane.cityB}`;
                  const expanded = expandedLane === key;
                  return (
                    <Fragment key={key}>
                      <tr
                        className="cursor-pointer border-b border-slate-200 hover:bg-slate-50"
                        onClick={() => setExpandedLane(expanded ? undefined : key)}
                      >
                        <td className="whitespace-nowrap px-2 py-1.5 capitalize text-slate-900">
                          {lane.cityA} ↔ {lane.cityB}
                        </td>
                        <Td>{lane.movementsObserved}</Td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-body tabular-nums text-slate-700">
                          {lane.tripsAtoB} / {lane.tripsBtoA}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-body text-slate-700">
                          {formatDirection(lane)}
                        </td>
                        <Td align="right">{formatNumber(lane.distanceKm)} km</Td>
                        <Td align="right" emphasis>
                          {formatNumber(lane.emptyKm)} km
                        </Td>
                        <Td align="right">€{formatNumber(lane.emptyDieselCostEur)}</Td>
                        <Td align="right">{formatNumber(lane.wellToTankGrams / 1_000, 1)} kg</Td>
                        <Td align="right">{formatNumber(lane.tankToWheelGrams / 1_000, 1)} kg</Td>
                        <Td align="right" emphasis>
                          {formatNumber(lane.wellToWheelGrams / 1_000, 1)} kg
                        </Td>
                        <td className="whitespace-nowrap px-2 py-1.5">
                          <DataQualityBadge grade={lane.confidenceGrade} />
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <td colSpan={11} className="px-3 py-3 text-slate-700">
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
        <SectionTitle>EU ETS2 cost scenarios</SectionTitle>
        <p className="mb-2 mt-2 text-body text-slate-600">
          ETS2 applies a carbon price to road transport fuel from 1 January 2028. €45/tCO2e is the
          system&apos;s price-containment threshold (2020-adjusted) — the closest thing to an
          official anchor price this market has. €63 is the upper end of pre-delay projections (ICAP
          / EEA / Transport &amp; Environment); €0 shows the cost case with no carbon price at all,
          since the date has already slipped once.
        </p>
        <table className="w-full max-w-md border-collapse">
          <thead>
            <tr className="border-b border-slate-400 text-left">
              <Th>Carbon price</Th>
              <Th align="right">Added cost</Th>
            </tr>
          </thead>
          <tbody>
            {carbonPrices.map((price) => (
              <tr key={price} className="border-b border-slate-200">
                <td className="px-2 py-1.5 text-body tabular-nums text-slate-700">
                  €{formatNumber(price)}/t
                  {price === ETS2_PRICE_CONTAINMENT_ANCHOR_EUR_PER_TONNE && (
                    <span className="ml-2 text-caption text-slate-500">
                      (price-containment anchor)
                    </span>
                  )}
                </td>
                <Td align="right" emphasis>
                  €{formatNumber(ets2CostEur(totalCO2e, price))}
                </Td>
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
            className="w-40 border border-slate-300 px-2 py-1 text-caption tabular-nums"
          />
          <button
            type="button"
            onClick={addCustomPrice}
            className="border border-slate-300 px-2 py-1 text-caption"
          >
            Add scenario
          </button>
        </div>
      </section>

      {report.issues.length > 0 && (
        <section className="mb-8 print:hidden">
          <Label>
            {report.issues.length} row{report.issues.length === 1 ? '' : 's'} excluded
          </Label>
          <ul className="mt-1 space-y-1 text-caption text-slate-600">
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-caption text-slate-600">{label}:</span>
      <DataValue className="text-body font-medium">{value}</DataValue>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`whitespace-nowrap px-2 py-1.5 text-label font-medium text-slate-600 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function SortableTh({
  children,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  sort: { key: SortKey; direction: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className={`whitespace-nowrap px-2 py-1.5 text-label font-medium ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 print:pointer-events-none ${
          active ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        {children}
        <span aria-hidden="true" className="text-slate-400">
          {active ? (sort.direction === 'desc' ? '↓' : '↑') : '↕'}
        </span>
      </button>
    </th>
  );
}

function Td({
  children,
  align = 'left',
  emphasis = false,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  emphasis?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap px-2 py-1.5 text-body tabular-nums ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${emphasis ? 'font-medium text-slate-900' : 'text-slate-700'}`}
    >
      {children}
    </td>
  );
}

function LaneDerivation({ lane }: { lane: LaneReportRow }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
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
        label="WTT"
        formula={`${formatNumber(lane.emptyKm)} km × consumption × WTT factor`}
        value={`${formatNumber(lane.wellToTankGrams / 1_000, 1)} kg`}
      />
      <DerivationItem
        label="TTW"
        formula={`${formatNumber(lane.emptyKm)} km × consumption × TTW factor`}
        value={`${formatNumber(lane.tankToWheelGrams / 1_000, 1)} kg`}
      />
      <DerivationItem
        label="WTW"
        formula="WTT + TTW"
        value={`${formatNumber(lane.wellToWheelGrams / 1_000, 1)} kg`}
      />
      <DerivationItem
        label="Assumed vehicle"
        formula="majority equipment type on this lane"
        value={lane.assumedVehicleCategory}
      />
      <DerivationItem
        label="Confidence"
        formula={`${lane.movementsObserved} movement${lane.movementsObserved === 1 ? '' : 's'} observed`}
        value={lane.confidenceGrade}
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
      <dt className="text-caption text-slate-500">{label}</dt>
      <dd className="text-body tabular-nums text-slate-900">{value}</dd>
      <dd className="text-caption text-slate-400">{formula}</dd>
    </div>
  );
}
