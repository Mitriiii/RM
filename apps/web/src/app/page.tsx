import Link from 'next/link';
import {
  DEFAULT_DIESEL_PRICE_CAPTURED_ON,
  DEFAULT_DIESEL_PRICE_EUR_PER_LITRE,
  DEFAULT_DIESEL_PRICE_SOURCE,
  DEFAULT_DIESEL_TTW_KG_CO2E_PER_LITRE,
  DEFAULT_DIESEL_WTT_KG_CO2E_PER_LITRE,
  ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE,
} from '@/lib/diagnostic/costs';
import { Caption, PageTitle, Prose } from '@/components/ui/Typography';
import { getEquipmentOptions } from '@/lib/calculator/equipmentOptions';
import { InstantImpactCalculator } from './InstantImpactCalculator';
import { SEEDED_CITIES, SEEDED_CORRIDORS, createSeededCorridorCache } from '@freyo/routing';
import type { CalculatorCorridor } from '@/lib/calculator/calculator';

/**
 * The calculator's corridor list is read through packages/routing's own real DistanceCache
 * interface (see @freyo/routing's seededCorridors.ts and ADR 0009) — never a straight-line
 * distance computed for this screen. This runs server-side, once per request, not once per
 * keystroke: the interactive recompute in InstantImpactCalculator only ever re-runs the pure
 * fuel/CO2e math over these already-resolved numbers.
 */
async function loadCorridors(): Promise<readonly CalculatorCorridor[]> {
  const cache = await createSeededCorridorCache();
  const corridors: CalculatorCorridor[] = [];
  for (const corridor of SEEDED_CORRIDORS) {
    const cityA = SEEDED_CITIES.find((c) => c.key === corridor.cityAKey);
    const cityB = SEEDED_CITIES.find((c) => c.key === corridor.cityBKey);
    if (!cityA || !cityB) continue;
    const cached = await cache.get({
      origin: cityA.coordinates,
      destination: cityB.coordinates,
      profile: 'car',
      routingEngineVersion: 'osrm-public-demo-DO_NOT_USE_IN_PRODUCTION',
    });
    if (!cached) continue; // Never fall back to an estimate — a miss just isn't offered.
    corridors.push({
      id: corridor.id,
      cityAName: cityA.name,
      cityBName: cityB.name,
      distanceKm: cached.distance,
    });
  }
  return corridors;
}

export default async function HomePage() {
  const corridors = await loadCorridors();
  const equipmentOptions = getEquipmentOptions();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <PageTitle>Freyo</PageTitle>
      <Prose className="mt-3">
        Freyo measures ISO 14083-compliant emissions for every shipment a member moves, and helps
        members pool forward freight so empty return legs get matched — Freyo never touches a rate
        or brokers a load.
      </Prose>
      <Caption className="mt-2">
        <Link href="/methodology" className="underline">
          ISO 14083 methodology
        </Link>{' '}
        · Every number traces to its inputs.
      </Caption>

      <div className="mt-10">
        <InstantImpactCalculator
          corridors={corridors}
          equipmentOptions={equipmentOptions}
          defaultCarbonPricesEurPerTonne={ETS2_DEFAULT_CARBON_PRICES_EUR_PER_TONNE}
          dieselPriceDefaultEurPerLitre={DEFAULT_DIESEL_PRICE_EUR_PER_LITRE}
          dieselPriceSource={DEFAULT_DIESEL_PRICE_SOURCE}
          dieselPriceCapturedOn={DEFAULT_DIESEL_PRICE_CAPTURED_ON}
          dieselWttKgCO2ePerLitre={DEFAULT_DIESEL_WTT_KG_CO2E_PER_LITRE}
          dieselTtwKgCO2ePerLitre={DEFAULT_DIESEL_TTW_KG_CO2E_PER_LITRE}
        />
      </div>

      <Caption className="mt-10">
        Want the audit-grade version?{' '}
        <Link href="/diagnostic" className="font-medium text-slate-900 underline">
          Upload your real shipment history
        </Link>
        .
      </Caption>
    </main>
  );
}
