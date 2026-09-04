import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createFactorSet,
  type FactorSetId,
  type TransportOperationCategoryKey,
} from '@freyo/factors';
import { gramsCO2ePerTonneKilometre, kilograms, kilometres } from '@freyo/shared';
import { describe, expect, it } from 'vitest';
import { calculateLegEmissions, summarizeTransportChain } from './emissions.js';
import type { DataQualityGrade, LegInput, ShipmentOnLeg } from './types.js';

// Fictional numbers, clearly marked — never real emission data. See CLAUDE.md and
// packages/factors/data/README.md. These must match the factor set used to compute every
// golden fixture's `expected` block by hand.
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
};

const ARTICULATED_40T_ES = {
  vehicleType: 'articulated-40t',
  fuelType: 'diesel',
  loadProfile: 'average',
  region: 'ES',
};

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

function loadGolden<T>(name: string): T {
  const path = fileURLToPath(new URL(`./__fixtures__/golden/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

interface LegFixture {
  readonly toc: TransportOperationCategoryKey;
  readonly distanceKm: number;
  readonly routingSource: string;
  readonly dataQuality: DataQualityGrade;
}

function toLegInput(fixture: LegFixture): LegInput {
  return {
    toc: fixture.toc,
    distance: kilometres(fixture.distanceKm),
    routingSource: fixture.routingSource,
    dataQuality: fixture.dataQuality,
  };
}

const TOLERANCE = 6;

describe('golden scenario: Madrid -> Zaragoza, single shipment', () => {
  interface Golden {
    leg: LegFixture;
    shipments: { shipmentId: string; massKg: number }[];
    expected: {
      totals: { wellToTank: number; tankToWheel: number; wellToWheel: number };
      shipments: Record<
        string,
        { allocationShare: number; wellToTank: number; tankToWheel: number; wellToWheel: number }
      >;
    };
  }

  it('matches the hand-computed golden values', () => {
    const golden = loadGolden<Golden>('madrid-zaragoza-single-shipment.json');
    const shipments: ShipmentOnLeg[] = golden.shipments.map((s) => ({
      shipmentId: s.shipmentId,
      mass: kilograms(s.massKg),
    }));

    const result = calculateLegEmissions(toLegInput(golden.leg), shipments, buildTestFactorSet());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.totals.wellToTank).toBeCloseTo(golden.expected.totals.wellToTank, TOLERANCE);
    expect(result.totals.tankToWheel).toBeCloseTo(golden.expected.totals.tankToWheel, TOLERANCE);
    expect(result.totals.wellToWheel).toBeCloseTo(golden.expected.totals.wellToWheel, TOLERANCE);

    for (const record of result.shipments) {
      const expected = golden.expected.shipments[record.shipmentId];
      expect(expected).toBeDefined();
      expect(record.allocationShare).toBeCloseTo(expected!.allocationShare, TOLERANCE);
      expect(record.wellToTank).toBeCloseTo(expected!.wellToTank, TOLERANCE);
      expect(record.tankToWheel).toBeCloseTo(expected!.tankToWheel, TOLERANCE);
      expect(record.wellToWheel).toBeCloseTo(expected!.wellToWheel, TOLERANCE);
    }
  });
});

describe('golden scenario: Madrid -> Valencia, shared leg', () => {
  interface Golden {
    leg: LegFixture;
    shipments: { shipmentId: string; massKg: number }[];
    expected: {
      totals: { wellToTank: number; tankToWheel: number; wellToWheel: number };
      shipments: Record<
        string,
        { allocationShare: number; wellToTank: number; tankToWheel: number; wellToWheel: number }
      >;
    };
  }

  it('matches the hand-computed golden values, and the allocation sums back to the leg total', () => {
    const golden = loadGolden<Golden>('madrid-valencia-shared-leg.json');
    const shipments: ShipmentOnLeg[] = golden.shipments.map((s) => ({
      shipmentId: s.shipmentId,
      mass: kilograms(s.massKg),
    }));

    const result = calculateLegEmissions(toLegInput(golden.leg), shipments, buildTestFactorSet());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.totals.wellToWheel).toBeCloseTo(golden.expected.totals.wellToWheel, TOLERANCE);

    let summedWellToWheel = 0;
    for (const record of result.shipments) {
      const expected = golden.expected.shipments[record.shipmentId];
      expect(expected).toBeDefined();
      expect(record.wellToTank).toBeCloseTo(expected!.wellToTank, TOLERANCE);
      expect(record.tankToWheel).toBeCloseTo(expected!.tankToWheel, TOLERANCE);
      expect(record.wellToWheel).toBeCloseTo(expected!.wellToWheel, TOLERANCE);
      summedWellToWheel += record.wellToWheel;
    }
    expect(summedWellToWheel).toBeCloseTo(result.totals.wellToWheel, TOLERANCE);
  });
});

describe('golden scenario: Madrid -> Zaragoza -> Barcelona, two-leg chain', () => {
  interface Golden {
    shipmentId: string;
    legs: (LegFixture & { shipments: { shipmentId: string; massKg: number }[] })[];
    expected: {
      legTotals: { wellToTank: number; tankToWheel: number; wellToWheel: number }[];
      shipCLegRecords: {
        wellToTank: number;
        tankToWheel: number;
        wellToWheel: number;
        allocationShare: number;
      }[];
      chain: { wellToTank: number; tankToWheel: number; wellToWheel: number };
    };
  }

  it('matches the hand-computed golden values across both legs and the chain summary', () => {
    const golden = loadGolden<Golden>('madrid-zaragoza-barcelona-chain.json');
    const factorSet = buildTestFactorSet();

    const shipCRecords = golden.legs.map((legFixture, legIndex) => {
      const shipments: ShipmentOnLeg[] = legFixture.shipments.map((s) => ({
        shipmentId: s.shipmentId,
        mass: kilograms(s.massKg),
      }));
      const result = calculateLegEmissions(toLegInput(legFixture), shipments, factorSet);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');

      const expectedTotals = golden.expected.legTotals[legIndex]!;
      expect(result.totals.wellToWheel).toBeCloseTo(expectedTotals.wellToWheel, TOLERANCE);

      const shipCRecord = result.shipments.find((r) => r.shipmentId === golden.shipmentId);
      expect(shipCRecord).toBeDefined();
      const expectedRecord = golden.expected.shipCLegRecords[legIndex]!;
      expect(shipCRecord!.allocationShare).toBeCloseTo(expectedRecord.allocationShare, TOLERANCE);
      expect(shipCRecord!.wellToWheel).toBeCloseTo(expectedRecord.wellToWheel, TOLERANCE);
      return shipCRecord!;
    });

    const chain = summarizeTransportChain(golden.shipmentId, shipCRecords);
    expect(chain.wellToTank).toBeCloseTo(golden.expected.chain.wellToTank, TOLERANCE);
    expect(chain.tankToWheel).toBeCloseTo(golden.expected.chain.tankToWheel, TOLERANCE);
    expect(chain.wellToWheel).toBeCloseTo(golden.expected.chain.wellToWheel, TOLERANCE);
  });
});
