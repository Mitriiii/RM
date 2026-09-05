'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Caption, DataValue, Label, SectionTitle } from '@/components/ui/Typography';
import {
  calculateInstantImpact,
  isValidRoundTripsPerMonth,
  MAX_ROUND_TRIPS_PER_MONTH,
  MIN_ROUND_TRIPS_PER_MONTH,
  type CalculatorCorridor,
} from '@/lib/calculator/calculator';
import {
  EMPTY_RUNNING_PRESETS,
  EMPTY_RUNNING_RATE_SOURCE,
} from '@/lib/calculator/emptyRunningPresets';
import type { EquipmentOption } from '@/lib/calculator/equipmentOptions';
import type { VehicleCategory } from '@/lib/diagnostic/equipment';

interface InstantImpactCalculatorProps {
  readonly corridors: readonly CalculatorCorridor[];
  readonly equipmentOptions: readonly EquipmentOption[];
  readonly defaultCarbonPricesEurPerTonne: readonly number[];
  readonly dieselPriceDefaultEurPerLitre: number;
  readonly dieselPriceSource: string;
  readonly dieselPriceCapturedOn: string;
  readonly dieselWttKgCO2ePerLitre: number;
  readonly dieselTtwKgCO2ePerLitre: number;
}

const CUSTOM_RATE_VALUE = 'custom';
const DEBOUNCE_MS = 200;
const DEFAULT_ROUND_TRIPS_PER_MONTH = 20;

function formatNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/**
 * Animates a displayed number toward `target` over `durationMs`, easing out. Falls back to an
 * instant snap for anyone with prefers-reduced-motion set — see the "instant impact
 * calculator" kickoff's explicit accessibility requirement. The animated value is presented
 * visually only (aria-hidden); a separate, non-animated live region announces the settled
 * value once per recompute, so a screen reader never hears every intermediate frame.
 */
function useAnimatedNumber(target: number, durationMs = 450): number {
  const reducedMotion = usePrefersReducedMotion();
  const [displayed, setDisplayed] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayed(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    const start = performance.now();
    let frameId: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplayed(from + (to - from) * eased);
      if (t < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, durationMs, reducedMotion]);

  return displayed;
}

function AnimatedValue({ value, format }: { value: number; format: (value: number) => string }) {
  // No aria-live here: the visible text updates on every animation frame, and a live region
  // on that would make a screen reader narrate every intermediate frame. A screen reader
  // reading this element in place still reads whatever it currently shows (normal,
  // non-live text is always readable); the separate aria-live region below announces the
  // settled result once per recompute for anyone not actively re-reading the numbers.
  const displayed = useAnimatedNumber(value);
  return <DataValue size="data-lg">{format(displayed)}</DataValue>;
}

export function InstantImpactCalculator({
  corridors,
  equipmentOptions,
  defaultCarbonPricesEurPerTonne,
  dieselPriceDefaultEurPerLitre,
  dieselPriceSource,
  dieselPriceCapturedOn,
  dieselWttKgCO2ePerLitre,
  dieselTtwKgCO2ePerLitre,
}: InstantImpactCalculatorProps) {
  const [corridorId, setCorridorId] = useState(corridors[0]?.id ?? '');
  const [equipmentValue, setEquipmentValue] = useState(equipmentOptions[0]?.value ?? '');
  const [roundTripsInput, setRoundTripsInput] = useState(String(DEFAULT_ROUND_TRIPS_PER_MONTH));
  const [rateMode, setRateMode] = useState<string>(String(EMPTY_RUNNING_PRESETS[0]?.value ?? 24));
  const [customRate, setCustomRate] = useState(24);
  const [dieselPrice, setDieselPrice] = useState(dieselPriceDefaultEurPerLitre);

  const roundTripsPerMonth = Number(roundTripsInput);
  const roundTripsValid = isValidRoundTripsPerMonth(roundTripsPerMonth);
  const emptyRunningRatePercent = rateMode === CUSTOM_RATE_VALUE ? customRate : Number(rateMode);

  const rawInputs = useMemo(
    () => ({
      corridorId,
      equipmentValue,
      roundTripsPerMonth: roundTripsValid ? roundTripsPerMonth : DEFAULT_ROUND_TRIPS_PER_MONTH,
      emptyRunningRatePercent,
      dieselPrice,
    }),
    [
      corridorId,
      equipmentValue,
      roundTripsValid,
      roundTripsPerMonth,
      emptyRunningRatePercent,
      dieselPrice,
    ],
  );

  const [debouncedInputs, setDebouncedInputs] = useState(rawInputs);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedInputs(rawInputs), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [rawInputs]);

  const corridor = corridors.find((c) => c.id === debouncedInputs.corridorId) ?? corridors[0];
  const equipment =
    equipmentOptions.find((o) => o.value === debouncedInputs.equipmentValue) ?? equipmentOptions[0];

  const result = useMemo(() => {
    if (!corridor || !equipment) return undefined;
    return calculateInstantImpact({
      corridor,
      vehicleCategory: equipment.category as VehicleCategory,
      roundTripsPerMonth: debouncedInputs.roundTripsPerMonth,
      emptyRunningRatePercent: debouncedInputs.emptyRunningRatePercent,
      dieselPriceEurPerLitre: debouncedInputs.dieselPrice,
      dieselWttKgCO2ePerLitre,
      dieselTtwKgCO2ePerLitre,
      carbonPricesEurPerTonne: defaultCarbonPricesEurPerTonne,
    });
  }, [
    corridor,
    equipment,
    debouncedInputs.roundTripsPerMonth,
    debouncedInputs.emptyRunningRatePercent,
    debouncedInputs.dieselPrice,
    dieselWttKgCO2ePerLitre,
    dieselTtwKgCO2ePerLitre,
    defaultCarbonPricesEurPerTonne,
  ]);

  const liveRegionText = result
    ? `Estimated ${formatNumber(result.estimatedEmptyKmPerMonth)} kilometres running empty per month, ` +
      `${formatNumber(result.wellToWheelGrams / 1_000)} kilograms of CO2e, ` +
      `€${formatNumber(result.dieselCostEurPerMonth)} in diesel.`
    : '';

  if (corridors.length === 0 || equipmentOptions.length === 0) {
    return (
      <p className="border border-slate-300 bg-slate-50 p-4 text-body text-slate-600">
        The instant calculator needs at least one routed corridor and one registered equipment type
        to run — neither is configured yet.
      </p>
    );
  }

  return (
    <section className="border border-slate-300 bg-slate-50 p-5">
      <SectionTitle>Instant impact calculator</SectionTitle>
      <Caption className="mt-1">
        No file, no signup. Move the inputs below and watch the estimate respond.
      </Caption>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <Label htmlFor="calc-corridor">Corridor</Label>
          <select
            id="calc-corridor"
            className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body"
            value={corridorId}
            onChange={(event) => setCorridorId(event.target.value)}
          >
            {corridors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cityAName} ↔ {c.cityBName} ({formatNumber(c.distanceKm)} km)
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <Label htmlFor="calc-equipment">Equipment type</Label>
          <select
            id="calc-equipment"
            className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body"
            value={equipmentValue}
            onChange={(event) => setEquipmentValue(event.target.value)}
          >
            {equipmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <Label htmlFor="calc-round-trips">Round trips per month</Label>
          <input
            id="calc-round-trips"
            type="number"
            min={MIN_ROUND_TRIPS_PER_MONTH}
            max={MAX_ROUND_TRIPS_PER_MONTH}
            className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body tabular-nums"
            value={roundTripsInput}
            onChange={(event) => setRoundTripsInput(event.target.value)}
            aria-invalid={!roundTripsValid}
            aria-describedby="calc-round-trips-note"
          />
          <Caption id="calc-round-trips-note" className="mt-1">
            {roundTripsValid
              ? "Your own estimate of your operation — Freyo hasn't observed this."
              : `Enter a number between ${MIN_ROUND_TRIPS_PER_MONTH} and ${MAX_ROUND_TRIPS_PER_MONTH}.`}
          </Caption>
        </label>

        <label className="block">
          <Label htmlFor="calc-empty-rate">Assumed empty-running rate</Label>
          <select
            id="calc-empty-rate"
            className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body"
            value={rateMode}
            onChange={(event) => setRateMode(event.target.value)}
          >
            {EMPTY_RUNNING_PRESETS.map((preset) => (
              <option key={preset.value} value={String(preset.value)}>
                {preset.label}
              </option>
            ))}
            <option value={CUSTOM_RATE_VALUE}>Custom</option>
          </select>
          {rateMode === CUSTOM_RATE_VALUE ? (
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={customRate}
                onChange={(event) => setCustomRate(Number(event.target.value))}
                aria-label="Custom empty-running rate, percent"
                className="flex-1"
              />
              <DataValue className="w-14 text-right">{customRate}%</DataValue>
            </div>
          ) : (
            <Caption className="mt-1">Source: {EMPTY_RUNNING_RATE_SOURCE}.</Caption>
          )}
        </label>

        <label className="block sm:col-span-2">
          <Label htmlFor="calc-diesel-price">Diesel price (€/L)</Label>
          <input
            id="calc-diesel-price"
            type="number"
            step="0.01"
            min={0}
            className="mt-1 block w-full max-w-xs border border-slate-300 bg-white px-2 py-1.5 text-body tabular-nums"
            value={dieselPrice}
            onChange={(event) => setDieselPrice(Number(event.target.value))}
          />
          <Caption className="mt-1">
            {dieselPriceSource}, captured {dieselPriceCapturedOn} — edit this.
          </Caption>
        </label>
      </div>

      {corridor && (
        <div className="mt-6">
          <div className="relative h-1 w-full bg-slate-200">
            <div
              className="absolute inset-y-0 left-0 bg-slate-900 transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${Math.min(100, Math.max(0, emptyRunningRatePercent))}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-caption text-slate-500">
            <span>{corridor.cityAName}</span>
            <span>{corridor.cityBName}</span>
          </div>
        </div>
      )}

      <div
        role="status"
        aria-label="This is an estimate, not an emissions record."
        className="mt-2 inline-block border border-amber-400 bg-amber-50 px-2 py-0.5 text-caption font-medium text-amber-900"
      >
        This is an estimate, not an emissions record
      </div>

      {result && corridor && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Caption>Estimated empty running</Caption>
            <div>
              <AnimatedValue
                value={result.estimatedEmptyKmPerMonth}
                format={(v) => `${formatNumber(v)} km/mo`}
              />
            </div>
          </div>
          <div>
            <Caption>Diesel cost</Caption>
            <div>
              <AnimatedValue
                value={result.dieselCostEurPerMonth}
                format={(v) => `€${formatNumber(v)}/mo`}
              />
            </div>
          </div>
          <div>
            <Caption>CO2e (WTW)</Caption>
            <div>
              <AnimatedValue
                value={result.wellToWheelGrams / 1_000}
                format={(v) => `${formatNumber(v, 1)} kg/mo`}
              />
            </div>
          </div>
        </div>
      )}

      {result && corridor && (
        <p className="mt-4 text-body text-slate-700">
          At a {formatNumber(emptyRunningRatePercent)}% empty-running rate on {corridor.cityAName} ↔{' '}
          {corridor.cityBName}, that&apos;s about the equivalent of{' '}
          <DataValue>{formatNumber(result.estimatedEmptyTripsPerMonth, 1)}</DataValue> of your{' '}
          <DataValue>{formatNumber(debouncedInputs.roundTripsPerMonth)}</DataValue> monthly round
          trips running completely empty.
        </p>
      )}

      {result && (
        <p aria-live="polite" className="sr-only">
          {liveRegionText}
        </p>
      )}

      {result && result.ets2Scenarios.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full max-w-md border-collapse">
            <thead>
              <tr className="border-b border-slate-400 text-left">
                <th className="px-2 py-1 text-label font-medium text-slate-600">Carbon price</th>
                <th className="px-2 py-1 text-right text-label font-medium text-slate-600">
                  Added cost/mo
                </th>
              </tr>
            </thead>
            <tbody>
              {result.ets2Scenarios.map((scenario) => (
                <tr key={scenario.carbonPriceEurPerTonne} className="border-b border-slate-200">
                  <td className="px-2 py-1 text-body tabular-nums text-slate-700">
                    €{formatNumber(scenario.carbonPriceEurPerTonne)}/t
                  </td>
                  <td className="px-2 py-1 text-right text-body tabular-nums font-medium text-slate-900">
                    €{formatNumber(scenario.costEur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
