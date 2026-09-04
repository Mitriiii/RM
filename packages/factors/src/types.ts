import type { GramsCO2ePerTonneKilometre } from '@freyo/shared';

/**
 * Identifies one immutable, published set of emission factors. There is no "latest" — every
 * lookup goes through an explicit id, so a stored calculation can always be re-run against
 * the exact factor set it originally used (see CLAUDE.md's reproducibility non-negotiable).
 */
export interface FactorSetId {
  readonly source: string;
  readonly version: string;
  /** ISO 8601 date (YYYY-MM-DD) the source published this version as effective from. */
  readonly effectiveDate: string;
}

export function factorSetKey(id: FactorSetId): string {
  return `${id.source}@${id.version}@${id.effectiveDate}`;
}

/**
 * A transport operation category, per CLAUDE.md: a grouping of similar operations by vehicle
 * type, fuel, load profile, and region. Each TOC has one emission intensity within a given
 * factor set.
 */
export interface TransportOperationCategoryKey {
  readonly vehicleType: string;
  readonly fuelType: string;
  readonly loadProfile: string;
  readonly region: string;
}

export function tocKeyToString(toc: TransportOperationCategoryKey): string {
  return `${toc.vehicleType}::${toc.fuelType}::${toc.loadProfile}::${toc.region}`;
}

/** Well-to-tank + tank-to-wheel = well-to-wheel, all per tonne-kilometre. */
export interface EmissionIntensity {
  readonly wellToTank: GramsCO2ePerTonneKilometre;
  readonly tankToWheel: GramsCO2ePerTonneKilometre;
  readonly wellToWheel: GramsCO2ePerTonneKilometre;
}

export class MissingFactorError extends Error {
  readonly factorSetId: FactorSetId;
  readonly requestedToc: TransportOperationCategoryKey;

  constructor(factorSetId: FactorSetId, requestedToc: TransportOperationCategoryKey) {
    super(
      `No emission factor for transport operation category ${tocKeyToString(requestedToc)} ` +
        `in factor set ${factorSetKey(factorSetId)}`,
    );
    this.name = 'MissingFactorError';
    this.factorSetId = factorSetId;
    this.requestedToc = requestedToc;
  }
}

/**
 * The only two shapes a lookup can return. There is deliberately no third case that carries a
 * guessed or averaged intensity — see CLAUDE.md's "never invent an emission factor".
 */
export type FactorLookupResult =
  | { readonly ok: true; readonly intensity: EmissionIntensity }
  | { readonly ok: false; readonly error: MissingFactorError };
