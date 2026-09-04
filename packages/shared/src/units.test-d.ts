/**
 * Type-only tests: these assertions are checked by `tsc`, never executed. They exist to
 * prove that mixing branded units is a compile error, not a runtime one. If a change to
 * units.ts ever makes one of these lines legal, the `@ts-expect-error` directive becomes
 * "unused" and `tsc --noEmit` fails — see packages/shared/package.json's `typecheck` script.
 */
import { expectTypeOf } from 'vitest';
import {
  type GramsCO2e,
  type Kilograms,
  type Kilometres,
  type TonneKilometres,
  kilograms,
  kilometres,
  transportActivity,
} from './units.js';

const mass: Kilograms = kilograms(1_000);
const distance: Kilometres = kilometres(650);

// @ts-expect-error — Kilograms is not assignable to Kilometres, even though both are numbers.
const wrongOrder: Kilometres = mass;

// @ts-expect-error — a bare number is not a Kilograms; it must go through the factory.
const bareNumber: Kilograms = 1_000;

// @ts-expect-error — transportActivity takes (mass, distance) in that unit order, not
// (distance, mass); passing them swapped must not typecheck.
transportActivity(distance, mass);

expectTypeOf(transportActivity(mass, distance)).toEqualTypeOf<TonneKilometres>();
expectTypeOf<Kilograms>().not.toEqualTypeOf<Kilometres>();
expectTypeOf<Kilograms>().not.toEqualTypeOf<GramsCO2e>();
expectTypeOf<Kilometres>().not.toEqualTypeOf<TonneKilometres>();

void wrongOrder;
void bareNumber;
