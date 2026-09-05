'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Caption, Label } from '@/components/ui/Typography';
import type { EquipmentOption } from '@/lib/calculator/equipmentOptions';
import { createPostingAction } from './actions';

interface PostCapacityFormProps {
  readonly memberId: string | undefined;
  readonly cityOptions: readonly string[];
  readonly equipmentOptions: readonly EquipmentOption[];
  readonly temperatureClassOptions: readonly { readonly value: string; readonly label: string }[];
  readonly adrClassOptions: readonly { readonly value: string; readonly label: string }[];
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PostCapacityForm({
  memberId,
  cityOptions,
  equipmentOptions,
  temperatureClassOptions,
  adrClassOptions,
}: PostCapacityFormProps) {
  const router = useRouter();
  const now = new Date();
  const later = new Date(now.getTime() + 12 * 3_600_000);

  const [originCity, setOriginCity] = useState(cityOptions[0] ?? '');
  const [destinationCity, setDestinationCity] = useState(cityOptions[1] ?? cityOptions[0] ?? '');
  const [vehicleType, setVehicleType] = useState(equipmentOptions[0]?.value ?? '');
  const [temperatureClass, setTemperatureClass] = useState(
    temperatureClassOptions[0]?.value ?? 'ambient',
  );
  const [adrClasses, setAdrClasses] = useState<readonly string[]>([]);
  const [availableFrom, setAvailableFrom] = useState(toDatetimeLocal(now));
  const [availableUntil, setAvailableUntil] = useState(toDatetimeLocal(later));
  const [capacityKg, setCapacityKg] = useState(20_000);
  const [capacityLoadingMetres, setCapacityLoadingMetres] = useState(13.6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function toggleAdrClass(value: string) {
    setAdrClasses((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!memberId) {
      setError('Select which member you are acting as (top of page) first.');
      return;
    }
    setSubmitting(true);
    setError(undefined);
    const result = await createPostingAction({
      memberId,
      originCity,
      destinationCity,
      vehicleType,
      temperatureClass: temperatureClass as 'ambient' | 'chilled' | 'frozen',
      adrClasses,
      availableFrom,
      availableUntil,
      capacityKg,
      capacityLoadingMetres,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push('/postings');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="block">
        <Label htmlFor="post-origin">Origin</Label>
        <select
          id="post-origin"
          value={originCity}
          onChange={(event) => setOriginCity(event.target.value)}
          className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body capitalize"
        >
          {cityOptions.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <Label htmlFor="post-destination">Destination</Label>
        <select
          id="post-destination"
          value={destinationCity}
          onChange={(event) => setDestinationCity(event.target.value)}
          className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body capitalize"
        >
          {cityOptions.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <Label htmlFor="post-equipment">Equipment type</Label>
        <select
          id="post-equipment"
          value={vehicleType}
          onChange={(event) => setVehicleType(event.target.value)}
          className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body"
        >
          {equipmentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <Label htmlFor="post-temp">Temperature class</Label>
        <select
          id="post-temp"
          value={temperatureClass}
          onChange={(event) => setTemperatureClass(event.target.value)}
          className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body"
        >
          {temperatureClassOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <Label htmlFor="post-available-from">Available from</Label>
        <input
          id="post-available-from"
          type="datetime-local"
          value={availableFrom}
          onChange={(event) => setAvailableFrom(event.target.value)}
          className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body tabular-nums"
        />
      </label>

      <label className="block">
        <Label htmlFor="post-available-until">Available until</Label>
        <input
          id="post-available-until"
          type="datetime-local"
          value={availableUntil}
          onChange={(event) => setAvailableUntil(event.target.value)}
          className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body tabular-nums"
        />
      </label>

      <label className="block">
        <Label htmlFor="post-capacity-kg">Gross weight capacity (kg)</Label>
        <input
          id="post-capacity-kg"
          type="number"
          min={1}
          value={capacityKg}
          onChange={(event) => setCapacityKg(Number(event.target.value))}
          className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body tabular-nums"
        />
      </label>

      <label className="block">
        <Label htmlFor="post-loading-metres">Loading metres</Label>
        <input
          id="post-loading-metres"
          type="number"
          min={0.1}
          step="0.1"
          value={capacityLoadingMetres}
          onChange={(event) => setCapacityLoadingMetres(Number(event.target.value))}
          className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-body tabular-nums"
        />
      </label>

      <div className="sm:col-span-2">
        <Label>ADR dangerous-goods classes certified (leave blank if none)</Label>
        <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {adrClassOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-1.5 text-caption text-slate-700"
            >
              <input
                type="checkbox"
                checked={adrClasses.includes(option.value)}
                onChange={() => toggleAdrClass(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="sm:col-span-2 text-body text-red-700">{error}</p>}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="border border-slate-900 bg-slate-900 px-4 py-2 text-label font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Posting…' : 'Post capacity'}
        </button>
        <Caption className="mt-2">
          No rate or price is ever collected here — Freyo never brokers a load.
        </Caption>
      </div>
    </form>
  );
}
