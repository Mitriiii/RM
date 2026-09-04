import 'dotenv/config';
import { EMISSIONS_ENGINE_VERSION, calculateLegEmissions } from '@freyo/emissions';
import {
  createFactorSet,
  type FactorSetId,
  type TransportOperationCategoryKey,
} from '@freyo/factors';
import { gramsCO2ePerTonneKilometre, kilograms, kilometres } from '@freyo/shared';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  capacityPostings,
  emissionRecords,
  legs,
  members,
  movementLegs,
  movements,
  sites,
} from './schema/index.js';

/**
 * Realistic Spanish corridor seed data: Madrid-Zaragoza-Barcelona, Madrid-Valencia,
 * Valencia-Barcelona (see CLAUDE.md). Runs as the migration/admin role, which bypasses row-
 * level security by design — this is the one place that's correct, since seed data spans
 * multiple members and no real request is making it.
 *
 * Distances are real-world approximate road distances entered by hand, NOT the output of a
 * routed call — packages/routing (kickoff Session 5) doesn't exist yet. Emission factors are
 * the same fictional TEST_ONLY values used throughout packages/emissions's tests —
 * packages/factors/data is still empty. Both are reflected honestly: routingSource says
 * `seed-manual-estimate`, not an engine name, and every emission record's dataQuality is
 * `default`, the lowest grade. Nothing this script inserts is audit-grade.
 */

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set — see .env.example');
}

const client = postgres(databaseUrl);
const db = drizzle(client);

const RIGID_12T_ES: TransportOperationCategoryKey = {
  vehicleType: 'rigid-12t',
  fuelType: 'diesel',
  loadProfile: 'average',
  region: 'ES',
};

const ARTICULATED_40T_ES: TransportOperationCategoryKey = {
  vehicleType: 'articulated-40t',
  fuelType: 'diesel',
  loadProfile: 'average',
  region: 'ES',
};

const TEST_ONLY_FACTOR_SET_ID: FactorSetId = {
  source: 'TEST_ONLY',
  version: '0',
  effectiveDate: '2020-01-01',
};

const factorSet = createFactorSet(TEST_ONLY_FACTOR_SET_ID, 'TEST_ONLY-GWP', [
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

async function insertEmissionRecord(input: {
  memberId: string;
  movementId: string;
  movementLegId: string;
  toc: TransportOperationCategoryKey;
  distanceKm: string;
  shipmentMassKg: number;
}): Promise<void> {
  const result = calculateLegEmissions(
    {
      toc: input.toc,
      distance: kilometres(Number(input.distanceKm)),
      routingSource: 'seed-manual-estimate',
      dataQuality: 'default',
    },
    [{ shipmentId: input.movementId, mass: kilograms(input.shipmentMassKg) }],
    factorSet,
  );
  if (!result.ok) {
    throw new Error(
      `seed: missing factor for ${JSON.stringify(input.toc)}: ${result.error.message}`,
    );
  }
  const record = result.shipments[0];
  if (!record) throw new Error('seed: calculateLegEmissions returned no shipment record');

  await db.insert(emissionRecords).values({
    memberId: input.memberId,
    movementId: input.movementId,
    movementLegId: input.movementLegId,
    vehicleType: input.toc.vehicleType,
    fuelType: input.toc.fuelType,
    loadProfile: input.toc.loadProfile,
    region: input.toc.region,
    distanceKm: input.distanceKm,
    routingSource: 'seed-manual-estimate',
    dataQuality: 'default',
    shipmentMassKg: String(input.shipmentMassKg),
    legTotalMassKg: String(input.shipmentMassKg),
    allocationShare: record.allocationShare,
    factorSetSource: TEST_ONLY_FACTOR_SET_ID.source,
    factorSetVersion: TEST_ONLY_FACTOR_SET_ID.version,
    factorSetEffectiveDate: TEST_ONLY_FACTOR_SET_ID.effectiveDate,
    gwpSet: factorSet.gwpSet,
    engineVersion: EMISSIONS_ENGINE_VERSION,
    wellToTankGrams: record.wellToTank.toFixed(4),
    tankToWheelGrams: record.tankToWheel.toFixed(4),
    wellToWheelGrams: record.wellToWheel.toFixed(4),
  });
}

async function main(): Promise<void> {
  const [shipper] = await db
    .insert(members)
    .values({ name: 'Ibérica Distribución S.A.', kind: 'shipper', countryCode: 'ES' })
    .returning();
  const [carrierAragon] = await db
    .insert(members)
    .values({ name: 'Transportes Aragón S.L.', kind: 'carrier', countryCode: 'ES' })
    .returning();
  const [carrierTuria] = await db
    .insert(members)
    .values({ name: 'Transportes Turia S.L.', kind: 'carrier', countryCode: 'ES' })
    .returning();
  if (!shipper || !carrierAragon || !carrierTuria) throw new Error('seed: member insert failed');

  const [madrid] = await db
    .insert(sites)
    .values({
      memberId: shipper.id,
      name: 'Madrid Depot',
      addressLine: 'Polígono Industrial San Fernando, Nave 12',
      city: 'Madrid',
      countryCode: 'ES',
      location: { x: -3.7038, y: 40.4168 },
    })
    .returning();
  const [zaragoza] = await db
    .insert(sites)
    .values({
      memberId: shipper.id,
      name: 'Zaragoza Cross-dock',
      addressLine: 'Plataforma Logística PLAZA, Calle B',
      city: 'Zaragoza',
      countryCode: 'ES',
      location: { x: -0.8891, y: 41.6488 },
    })
    .returning();
  const [barcelona] = await db
    .insert(sites)
    .values({
      memberId: shipper.id,
      name: 'Barcelona Depot',
      addressLine: 'Zona Franca, Carrer C',
      city: 'Barcelona',
      countryCode: 'ES',
      location: { x: 2.1686, y: 41.3874 },
    })
    .returning();
  const [valencia] = await db
    .insert(sites)
    .values({
      memberId: shipper.id,
      name: 'Valencia Depot',
      addressLine: 'Polígono Fuente del Jarro, Calle 5',
      city: 'Valencia',
      countryCode: 'ES',
      location: { x: -0.3763, y: 39.4699 },
    })
    .returning();
  if (!madrid || !zaragoza || !barcelona || !valencia) throw new Error('seed: site insert failed');

  const now = new Date();
  const hoursFromNow = (hours: number): Date => new Date(now.getTime() + hours * 3_600_000);

  // Movement 1: Madrid -> Barcelona, one shipment, two legs via Zaragoza — 8,000 kg of
  // general cargo, real corridor per CLAUDE.md's beachhead.
  const [movement1] = await db
    .insert(movements)
    .values({
      memberId: shipper.id,
      originSiteId: madrid.id,
      destinationSiteId: barcelona.id,
      equipmentType: 'rigid-12t/articulated-40t',
      massKg: '8000',
      pickupWindowStart: hoursFromNow(0),
      pickupWindowEnd: hoursFromNow(2),
      deliveryWindowStart: hoursFromNow(14),
      deliveryWindowEnd: hoursFromNow(18),
    })
    .returning();
  if (!movement1) throw new Error('seed: movement insert failed');

  const [leg1a] = await db
    .insert(legs)
    .values({
      memberId: carrierAragon.id,
      originSiteId: madrid.id,
      destinationSiteId: zaragoza.id,
      ...RIGID_12T_ES,
      distanceKm: '325',
      routingSource: 'seed-manual-estimate',
      departureAt: hoursFromNow(1),
    })
    .returning();
  const [leg1b] = await db
    .insert(legs)
    .values({
      memberId: carrierAragon.id,
      originSiteId: zaragoza.id,
      destinationSiteId: barcelona.id,
      ...ARTICULATED_40T_ES,
      distanceKm: '296',
      routingSource: 'seed-manual-estimate',
      departureAt: hoursFromNow(6),
    })
    .returning();
  if (!leg1a || !leg1b) throw new Error('seed: leg insert failed');

  const [movementLeg1a] = await db
    .insert(movementLegs)
    .values({
      movementId: movement1.id,
      legId: leg1a.id,
      sequenceIndex: 0,
      shipmentMassKg: '8000',
      dataQuality: 'default',
    })
    .returning();
  const [movementLeg1b] = await db
    .insert(movementLegs)
    .values({
      movementId: movement1.id,
      legId: leg1b.id,
      sequenceIndex: 1,
      shipmentMassKg: '8000',
      dataQuality: 'default',
    })
    .returning();
  if (!movementLeg1a || !movementLeg1b) throw new Error('seed: movement_leg insert failed');

  await insertEmissionRecord({
    memberId: shipper.id,
    movementId: movement1.id,
    movementLegId: movementLeg1a.id,
    toc: RIGID_12T_ES,
    distanceKm: '325',
    shipmentMassKg: 8000,
  });
  await insertEmissionRecord({
    memberId: shipper.id,
    movementId: movement1.id,
    movementLegId: movementLeg1b.id,
    toc: ARTICULATED_40T_ES,
    distanceKm: '296',
    shipmentMassKg: 8000,
  });

  // Movement 2: Madrid -> Valencia, one leg, 12,000 kg — a full articulated load.
  const [movement2] = await db
    .insert(movements)
    .values({
      memberId: shipper.id,
      originSiteId: madrid.id,
      destinationSiteId: valencia.id,
      equipmentType: 'articulated-40t',
      massKg: '12000',
      pickupWindowStart: hoursFromNow(0),
      pickupWindowEnd: hoursFromNow(2),
      deliveryWindowStart: hoursFromNow(8),
      deliveryWindowEnd: hoursFromNow(10),
    })
    .returning();
  if (!movement2) throw new Error('seed: movement insert failed');

  const [leg2] = await db
    .insert(legs)
    .values({
      memberId: carrierTuria.id,
      originSiteId: madrid.id,
      destinationSiteId: valencia.id,
      ...ARTICULATED_40T_ES,
      distanceKm: '357',
      routingSource: 'seed-manual-estimate',
      departureAt: hoursFromNow(1),
    })
    .returning();
  if (!leg2) throw new Error('seed: leg insert failed');

  const [movementLeg2] = await db
    .insert(movementLegs)
    .values({
      movementId: movement2.id,
      legId: leg2.id,
      sequenceIndex: 0,
      shipmentMassKg: '12000',
      dataQuality: 'default',
    })
    .returning();
  if (!movementLeg2) throw new Error('seed: movement_leg insert failed');

  await insertEmissionRecord({
    memberId: shipper.id,
    movementId: movement2.id,
    movementLegId: movementLeg2.id,
    toc: ARTICULATED_40T_ES,
    distanceKm: '357',
    shipmentMassKg: 12000,
  });

  // Movement 3: Valencia -> Barcelona, one leg, 5,500 kg.
  const [movement3] = await db
    .insert(movements)
    .values({
      memberId: shipper.id,
      originSiteId: valencia.id,
      destinationSiteId: barcelona.id,
      equipmentType: 'rigid-12t',
      massKg: '5500',
      pickupWindowStart: hoursFromNow(0),
      pickupWindowEnd: hoursFromNow(2),
      deliveryWindowStart: hoursFromNow(6),
      deliveryWindowEnd: hoursFromNow(8),
    })
    .returning();
  if (!movement3) throw new Error('seed: movement insert failed');

  const [leg3] = await db
    .insert(legs)
    .values({
      memberId: carrierTuria.id,
      originSiteId: valencia.id,
      destinationSiteId: barcelona.id,
      ...RIGID_12T_ES,
      distanceKm: '349',
      routingSource: 'seed-manual-estimate',
      departureAt: hoursFromNow(1),
    })
    .returning();
  if (!leg3) throw new Error('seed: leg insert failed');

  const [movementLeg3] = await db
    .insert(movementLegs)
    .values({
      movementId: movement3.id,
      legId: leg3.id,
      sequenceIndex: 0,
      shipmentMassKg: '5500',
      dataQuality: 'default',
    })
    .returning();
  if (!movementLeg3) throw new Error('seed: movement_leg insert failed');

  await insertEmissionRecord({
    memberId: shipper.id,
    movementId: movement3.id,
    movementLegId: movementLeg3.id,
    toc: RIGID_12T_ES,
    distanceKm: '349',
    shipmentMassKg: 5500,
  });

  // A couple of capacity postings — the empty-return-leg pooling the Exchange exists for.
  await db.insert(capacityPostings).values([
    {
      memberId: carrierAragon.id,
      originSiteId: barcelona.id,
      destinationSiteId: madrid.id,
      vehicleType: 'articulated-40t',
      availableFrom: hoursFromNow(20),
      availableUntil: hoursFromNow(30),
      capacityKg: '18000',
    },
    {
      memberId: carrierTuria.id,
      originSiteId: valencia.id,
      destinationSiteId: madrid.id,
      vehicleType: 'articulated-40t',
      availableFrom: hoursFromNow(12),
      availableUntil: hoursFromNow(20),
      capacityKg: '20000',
    },
  ]);

  console.log(
    'Seed complete: 3 members, 4 sites, 3 movements, 4 legs, 4 emission records, 2 capacity postings.',
  );
}

await main();
await client.end();
