import type { Coordinates } from '@freyo/routing';

/**
 * A small, curated lookup of major Spanish city-centre coordinates, used to resolve a
 * shipment CSV's origin/destination text into coordinates the routing engine can use. This
 * is deliberately not a geocoding service — there is no fuzzy matching, no external API call,
 * and no fallback guess. A city not in this table fails loudly (see resolveCity below) so a
 * user corrects their data rather than silently routing against a wrong location.
 *
 * Coordinates are public, well-known city-centre points, not sensitive or invented data —
 * the same kind used for the seed data in packages/db/src/seed.ts.
 */
const SPANISH_CITY_COORDINATES: Readonly<Record<string, Coordinates>> = {
  madrid: { longitude: -3.7038, latitude: 40.4168 },
  barcelona: { longitude: 2.1686, latitude: 41.3874 },
  valencia: { longitude: -0.3763, latitude: 39.4699 },
  zaragoza: { longitude: -0.8891, latitude: 41.6488 },
  sevilla: { longitude: -5.9845, latitude: 37.3891 },
  seville: { longitude: -5.9845, latitude: 37.3891 },
  malaga: { longitude: -4.4214, latitude: 36.7213 },
  murcia: { longitude: -1.1307, latitude: 37.9922 },
  bilbao: { longitude: -2.935, latitude: 43.263 },
  alicante: { longitude: -0.4907, latitude: 38.3452 },
  cordoba: { longitude: -4.7794, latitude: 37.8882 },
  valladolid: { longitude: -4.7245, latitude: 41.6523 },
  vigo: { longitude: -8.7226, latitude: 42.2406 },
  gijon: { longitude: -5.6615, latitude: 43.5322 },
  palma: { longitude: 2.6502, latitude: 39.5696 },
  'las palmas': { longitude: -15.4363, latitude: 28.1235 },
  toledo: { longitude: -4.0273, latitude: 39.8628 },
  logrono: { longitude: -2.445, latitude: 42.4627 },
  pamplona: { longitude: -1.6432, latitude: 42.8125 },
  tarragona: { longitude: 1.2445, latitude: 41.1189 },
  huesca: { longitude: -0.4085, latitude: 42.1401 },
};

function normalizeCityName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export interface CityResolutionResult {
  readonly ok: true;
  readonly coordinates: Coordinates;
}

export interface CityResolutionError {
  readonly ok: false;
  readonly city: string;
}

/**
 * Resolves a free-text city name to coordinates, or reports failure — there is no
 * approximate match and no default. See the module doc comment for why.
 */
export function resolveCity(city: string): CityResolutionResult | CityResolutionError {
  const coordinates = SPANISH_CITY_COORDINATES[normalizeCityName(city)];
  if (!coordinates) {
    return { ok: false, city };
  }
  return { ok: true, coordinates };
}

export function knownCities(): readonly string[] {
  return Object.keys(SPANISH_CITY_COORDINATES);
}
