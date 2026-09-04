/**
 * Branded numeric units. A `number` alone carries no unit information, and unit confusion
 * (kilograms passed where tonnes were expected, kilometres where metres were expected) is
 * the classic silent failure mode in emissions software — see CLAUDE.md. Every quantity that
 * crosses a module boundary in this codebase must be one of these branded types, never a
 * bare `number`.
 *
 * The brand is a phantom field that exists only in the type system — at runtime these are
 * plain numbers — so construction always goes through the validating factory functions below
 * rather than an `as` cast.
 */
type Brand<Value, Tag extends string> = Value & { readonly __unit__: Tag };

export type Kilograms = Brand<number, 'Kilograms'>;
export type Kilometres = Brand<number, 'Kilometres'>;
export type TonneKilometres = Brand<number, 'TonneKilometres'>;
export type GramsCO2e = Brand<number, 'GramsCO2e'>;

export class InvalidUnitValueError extends RangeError {
  constructor(unit: string, value: number) {
    super(`${unit} value must be finite and non-negative, got ${value}`);
    this.name = 'InvalidUnitValueError';
  }
}

function brand<Tag extends string>(unit: Tag, value: number): Brand<number, Tag> {
  if (!Number.isFinite(value) || value < 0) {
    throw new InvalidUnitValueError(unit, value);
  }
  return value as Brand<number, Tag>;
}

export function kilograms(value: number): Kilograms {
  return brand('Kilograms', value);
}

export function kilometres(value: number): Kilometres {
  return brand('Kilometres', value);
}

export function tonneKilometres(value: number): TonneKilometres {
  return brand('TonneKilometres', value);
}

export function gramsCO2e(value: number): GramsCO2e {
  return brand('GramsCO2e', value);
}

const KILOGRAMS_PER_TONNE = 1_000;
const METRES_PER_KILOMETRE = 1_000;
const GRAMS_PER_KILOGRAM = 1_000;

export function kilogramsToTonnes(value: Kilograms): number {
  return value / KILOGRAMS_PER_TONNE;
}

export function tonnesToKilograms(tonnes: number): Kilograms {
  return kilograms(tonnes * KILOGRAMS_PER_TONNE);
}

export function kilometresToMetres(value: Kilometres): number {
  return value * METRES_PER_KILOMETRE;
}

export function metresToKilometres(metres: number): Kilometres {
  return kilometres(metres / METRES_PER_KILOMETRE);
}

export function gramsCO2eToKilogramsCO2e(value: GramsCO2e): number {
  return value / GRAMS_PER_KILOGRAM;
}

export function kilogramsCO2eToGramsCO2e(kilogramsCO2e: number): GramsCO2e {
  return gramsCO2e(kilogramsCO2e * GRAMS_PER_KILOGRAM);
}

/**
 * Shipment transport activity for a leg: mass carried × routed distance, in
 * tonne-kilometres. This is the quantity a transport operation category's emission
 * intensity (gCO2e / tkm) multiplies against — see docs/methodology.md.
 */
export function transportActivity(mass: Kilograms, distance: Kilometres): TonneKilometres {
  return tonneKilometres(kilogramsToTonnes(mass) * distance);
}
