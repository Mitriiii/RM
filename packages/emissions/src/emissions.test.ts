import { createFactorSet, MissingFactorError, type FactorSetId } from '@freyo/factors';
import { gramsCO2ePerTonneKilometre, kilograms, kilometres } from '@freyo/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateLegEmissions, summarizeTransportChain } from './emissions.js';
import type { LegInput, ShipmentOnLeg } from './types.js';

// Fictional numbers, clearly marked — never real emission data. See CLAUDE.md and
// packages/factors/data/README.md.
const TEST_ONLY_ID: FactorSetId = {
  source: 'TEST_ONLY',
  version: '0',
  effectiveDate: '2020-01-01',
};

const RIGID_12T_ES = {
  vehicleType: 'rigid-12t',
  fuelType: 'diesel',
  loadProfile: 'average',
  region: 'ES',
} as const;

const ARTICULATED_40T_ES = {
  vehicleType: 'articulated-40t',
  fuelType: 'diesel',
  loadProfile: 'average',
  region: 'ES',
} as const;

function buildTestFactorSet() {
  return createFactorSet(TEST_ONLY_ID, 'TEST_ONLY-GWP', [
    {
      toc: RIGID_12T_ES,
      intensity: {
        wellToTank: gramsCO2ePerTonneKilometre(15),
        tankToWheel: gramsCO2ePerTonneKilometre(85),
        wellToWheel: gramsCO2ePerTonneKilometre(100),
      },
    },
    {
      toc: ARTICULATED_40T_ES,
      intensity: {
        wellToTank: gramsCO2ePerTonneKilometre(12),
        tankToWheel: gramsCO2ePerTonneKilometre(78),
        wellToWheel: gramsCO2ePerTonneKilometre(90),
      },
    },
  ]);
}

const baseLeg: LegInput = {
  toc: RIGID_12T_ES,
  distance: kilometres(325),
  routingSource: 'TEST_ONLY',
  dataQuality: 'modelled',
};

const nonNegativeFinite = fc.double({ min: 0, max: 20_000, noNaN: true, noDefaultInfinity: true });

const shipmentMasses = fc.array(nonNegativeFinite, { minLength: 1, maxLength: 8 });

function toShipments(masses: readonly number[]): ShipmentOnLeg[] {
  return masses.map((mass, index) => ({ shipmentId: `S${index}`, mass: kilograms(mass) }));
}

describe('calculateLegEmissions — allocation', () => {
  it('allocates the leg total across shipments in proportion to mass share', () => {
    fc.assert(
      fc.property(shipmentMasses, (masses) => {
        // Skip the degenerate all-zero-mass case: allocation share is defined as 0 for
        // everyone there, which the "sums to total" property below still covers separately.
        fc.pre(masses.some((m) => m > 0));

        const shipments = toShipments(masses);
        const factorSet = buildTestFactorSet();
        const result = calculateLegEmissions(baseLeg, shipments, factorSet);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        for (const record of result.shipments) {
          expect(record.allocationShare).toBeCloseTo(record.shipmentMass / record.legTotalMass, 9);
          expect(record.wellToWheel).toBeCloseTo(
            result.totals.wellToWheel * record.allocationShare,
            6,
          );
        }
      }),
    );
  });

  it('the sum of allocated shipment emissions across a shared leg equals the leg total', () => {
    fc.assert(
      fc.property(shipmentMasses, (masses) => {
        const shipments = toShipments(masses);
        const factorSet = buildTestFactorSet();
        const result = calculateLegEmissions(baseLeg, shipments, factorSet);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const shipmentRecords = result.shipments;
        let allocatedWellToTank = 0;
        let allocatedTankToWheel = 0;
        let allocatedWellToWheel = 0;
        for (const record of shipmentRecords) {
          allocatedWellToTank += record.wellToTank;
          allocatedTankToWheel += record.tankToWheel;
          allocatedWellToWheel += record.wellToWheel;
        }

        expect(allocatedWellToTank).toBeCloseTo(result.totals.wellToTank, 6);
        expect(allocatedTankToWheel).toBeCloseTo(result.totals.tankToWheel, 6);
        expect(allocatedWellToWheel).toBeCloseTo(result.totals.wellToWheel, 6);
      }),
    );
  });

  it('is zero for every shipment when the leg carries zero mass', () => {
    const factorSet = buildTestFactorSet();
    const result = calculateLegEmissions(
      baseLeg,
      [{ shipmentId: 'S0', mass: kilograms(0) }],
      factorSet,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totals.wellToWheel).toBe(0);
    expect(result.shipments[0]?.wellToWheel).toBe(0);
  });

  it('rejects an empty shipment list rather than silently returning zero results', () => {
    expect(() => calculateLegEmissions(baseLeg, [], buildTestFactorSet())).toThrow(RangeError);
  });
});

describe('calculateLegEmissions — unit handling', () => {
  it('well-to-wheel equals well-to-tank + tank-to-wheel at both leg and shipment level', () => {
    fc.assert(
      fc.property(
        shipmentMasses,
        fc.double({ min: 0, max: 2_000, noNaN: true }),
        (masses, distanceKm) => {
          const shipments = toShipments(masses);
          const leg: LegInput = { ...baseLeg, distance: kilometres(distanceKm) };
          const result = calculateLegEmissions(leg, shipments, buildTestFactorSet());
          expect(result.ok).toBe(true);
          if (!result.ok) return;

          expect(result.totals.wellToWheel).toBeCloseTo(
            result.totals.wellToTank + result.totals.tankToWheel,
            6,
          );
          for (const record of result.shipments) {
            expect(record.wellToWheel).toBeCloseTo(record.wellToTank + record.tankToWheel, 6);
          }
        },
      ),
    );
  });

  it('scales linearly with distance', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 20_000, noNaN: true }),
        fc.double({ min: 0, max: 2_000, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        (mass, distanceKm, factor) => {
          const factorSet = buildTestFactorSet();
          const shipments: ShipmentOnLeg[] = [{ shipmentId: 'S0', mass: kilograms(mass) }];
          const base = calculateLegEmissions(
            { ...baseLeg, distance: kilometres(distanceKm) },
            shipments,
            factorSet,
          );
          const scaled = calculateLegEmissions(
            { ...baseLeg, distance: kilometres(distanceKm * factor) },
            shipments,
            factorSet,
          );
          expect(base.ok && scaled.ok).toBe(true);
          if (!base.ok || !scaled.ok) return;
          expect(scaled.totals.wellToWheel).toBeCloseTo(base.totals.wellToWheel * factor, 4);
        },
      ),
    );
  });
});

describe('calculateLegEmissions — missing factors', () => {
  it('returns a typed MissingFactorError and no numeric result, never a fallback', () => {
    const factorSet = buildTestFactorSet();
    const unknownToc = { ...RIGID_12T_ES, region: 'PT' };
    const result = calculateLegEmissions(
      { ...baseLeg, toc: unknownToc },
      [{ shipmentId: 'S0', mass: kilograms(1_000) }],
      factorSet,
    );
    expect(result.ok).toBe(false);
    expect('totals' in result).toBe(false);
    expect('shipments' in result).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(MissingFactorError);
    }
  });
});

describe('summarizeTransportChain', () => {
  it('sums a shipment’s allocated emissions across every leg of its chain', () => {
    const factorSet = buildTestFactorSet();
    const shipment: ShipmentOnLeg = { shipmentId: 'S0', mass: kilograms(8_000) };

    const legOne = calculateLegEmissions(
      { ...baseLeg, toc: RIGID_12T_ES, distance: kilometres(325) },
      [shipment],
      factorSet,
    );
    const legTwo = calculateLegEmissions(
      { ...baseLeg, toc: ARTICULATED_40T_ES, distance: kilometres(296) },
      [shipment],
      factorSet,
    );
    expect(legOne.ok && legTwo.ok).toBe(true);
    if (!legOne.ok || !legTwo.ok) return;

    const chain = summarizeTransportChain('S0', [legOne.shipments[0]!, legTwo.shipments[0]!]);
    expect(chain.wellToTank).toBeCloseTo(
      legOne.shipments[0]!.wellToTank + legTwo.shipments[0]!.wellToTank,
      6,
    );
    expect(chain.wellToWheel).toBeCloseTo(chain.wellToTank + chain.tankToWheel, 6);
  });

  it('rejects records that belong to a different shipment', () => {
    const factorSet = buildTestFactorSet();
    const result = calculateLegEmissions(
      baseLeg,
      [{ shipmentId: 'S0', mass: kilograms(8_000) }],
      factorSet,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(() => summarizeTransportChain('S1', result.shipments)).toThrow(RangeError);
  });
});
