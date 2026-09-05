/**
 * Shared domain enums for the capacity-posting UI (and anywhere else that needs the same
 * vocabulary) — a single, real source so a form's dropdown options can never drift out of
 * sync with what packages/matching's hard constraints actually check. Structurally
 * compatible with (not imported from) packages/matching's own `TemperatureClass` — that
 * package depends on packages/shared, not the other way round, so this is a deliberate,
 * duplicated literal type rather than a new dependency edge; TypeScript's structural typing
 * makes the two interchangeable wherever both are used.
 */
export type TemperatureClass = 'ambient' | 'chilled' | 'frozen';

export interface LabeledOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export const TEMPERATURE_CLASS_OPTIONS: readonly LabeledOption<TemperatureClass>[] = [
  { value: 'ambient', label: 'Ambient' },
  { value: 'chilled', label: 'Chilled' },
  { value: 'frozen', label: 'Frozen' },
];

/**
 * The UN/ADR dangerous-goods classes (European Agreement concerning the International
 * Carriage of Dangerous Goods by Road) — a real, public, well-known classification, not an
 * invented list. A posting's `adrClasses` names what the vehicle and driver are certified to
 * carry; an empty selection means no dangerous goods, matching
 * packages/matching's own `EquipmentSpec.adrClasses` semantics exactly.
 */
export type AdrClass =
  '1' | '2' | '3' | '4.1' | '4.2' | '4.3' | '5.1' | '5.2' | '6.1' | '6.2' | '7' | '8' | '9';

export const ADR_CLASS_OPTIONS: readonly LabeledOption<AdrClass>[] = [
  { value: '1', label: 'Class 1 — Explosives' },
  { value: '2', label: 'Class 2 — Gases' },
  { value: '3', label: 'Class 3 — Flammable liquids' },
  { value: '4.1', label: 'Class 4.1 — Flammable solids' },
  { value: '4.2', label: 'Class 4.2 — Spontaneously combustible' },
  { value: '4.3', label: 'Class 4.3 — Dangerous when wet' },
  { value: '5.1', label: 'Class 5.1 — Oxidizing substances' },
  { value: '5.2', label: 'Class 5.2 — Organic peroxides' },
  { value: '6.1', label: 'Class 6.1 — Toxic substances' },
  { value: '6.2', label: 'Class 6.2 — Infectious substances' },
  { value: '7', label: 'Class 7 — Radioactive material' },
  { value: '8', label: 'Class 8 — Corrosive substances' },
  { value: '9', label: 'Class 9 — Miscellaneous dangerous goods' },
];
