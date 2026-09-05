import { loadFactorSetFromFile, resolveFactorDataPath, type FactorSet } from '@freyo/factors';
import type { VehicleCategory } from '@/lib/diagnostic/equipment';

/**
 * The one real, versioned factor set this codebase has (see
 * packages/factors/data/uk-desnz-ghg-conversion-factors/2026-flat-file-v1.2 and ADR 0009).
 * Loaded once per server process, not per request — `loadFactorSetFromFile` does synchronous
 * file I/O and JSON-schema validation, cheap to do once and reuse.
 */
const PRODUCTION_FACTOR_SET_PATH = resolveFactorDataPath(
  'uk-desnz-ghg-conversion-factors/2026-flat-file-v1.2/factors.json',
);

let cachedFactorSet: FactorSet | undefined;

export function getProductionFactorSet(): FactorSet {
  cachedFactorSet ??= loadFactorSetFromFile(PRODUCTION_FACTOR_SET_PATH);
  return cachedFactorSet;
}

export interface EquipmentOption {
  readonly value: string;
  readonly label: string;
  readonly category: VehicleCategory;
}

/**
 * Maps a registered transport-operation-category vehicle type to the empty-running fuel
 * model's simpler category (see apps/web/src/lib/diagnostic/equipment.ts). Explicit, not
 * keyword-guessed: the registry currently has exactly these two vehicle types, and this list
 * is checked by a test that fails loudly if the registry ever adds one this map doesn't cover
 * — see equipmentOptions.test.ts.
 */
const VEHICLE_TYPE_TO_CATEGORY: Readonly<Record<string, VehicleCategory>> = {
  'rigid-12t': 'rigid',
  'articulated-40t': 'articulated',
};

const VEHICLE_TYPE_LABELS: Readonly<Record<string, string>> = {
  'rigid-12t': 'Rigid truck (12t)',
  'articulated-40t': 'Articulated truck (40t)',
};

/**
 * Populates the calculator's equipment-type dropdown from the real registry's own entries —
 * never a hand-written list that could silently drift out of sync with what factors actually
 * exist (see CLAUDE.md non-negotiable #2 and the "make Freyo an instant impact calculator"
 * kickoff's Session 6.10 spec). Deduplicates by vehicleType, since the registry may hold more
 * than one region/load-profile entry for the same vehicle type.
 */
export function getEquipmentOptions(
  factorSet: FactorSet = getProductionFactorSet(),
): readonly EquipmentOption[] {
  const seen = new Set<string>();
  const options: EquipmentOption[] = [];
  for (const entry of factorSet.list()) {
    const vehicleType = entry.toc.vehicleType;
    if (seen.has(vehicleType)) continue;
    seen.add(vehicleType);
    const category = VEHICLE_TYPE_TO_CATEGORY[vehicleType];
    if (!category) continue; // Reported by a dedicated test, not silently dropped in production.
    options.push({
      value: vehicleType,
      label: VEHICLE_TYPE_LABELS[vehicleType] ?? vehicleType,
      category,
    });
  }
  return options;
}

/** Every vehicleType VEHICLE_TYPE_TO_CATEGORY does not cover, for a test to assert is empty —
 * a registry that outgrows this map should fail a test, not silently omit an option. */
export function unmappedVehicleTypes(
  factorSet: FactorSet = getProductionFactorSet(),
): readonly string[] {
  const seen = new Set<string>();
  for (const entry of factorSet.list()) seen.add(entry.toc.vehicleType);
  return [...seen].filter((vehicleType) => !(vehicleType in VEHICLE_TYPE_TO_CATEGORY));
}
