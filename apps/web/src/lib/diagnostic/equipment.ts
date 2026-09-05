export type VehicleCategory = 'rigid' | 'articulated';

const ARTICULATED_KEYWORDS = [
  'articulated',
  'artic',
  'semi',
  'trailer',
  '40t',
  'mega',
  'tautliner',
];
const RIGID_KEYWORDS = ['rigid', 'straight truck', 'box truck', '12t', 'solo'];

/**
 * Normalizes a free-text equipment-type string into one of the two categories this
 * diagnostic's diesel-consumption defaults distinguish. Returns undefined for anything
 * unrecognized rather than guessing — an unrecognized equipment type is reported back to the
 * user as a row to fix, not silently assigned a category.
 */
export function normalizeEquipmentType(raw: string): VehicleCategory | undefined {
  const normalized = raw.trim().toLowerCase();
  if (ARTICULATED_KEYWORDS.some((keyword) => normalized.includes(keyword))) return 'articulated';
  if (RIGID_KEYWORDS.some((keyword) => normalized.includes(keyword))) return 'rigid';
  return undefined;
}
