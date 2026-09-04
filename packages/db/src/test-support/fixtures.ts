import type { Database } from '../client.js';
import { legs, members, movementLegs, movements, sites } from '../schema/index.js';

type MemberKind = 'shipper' | 'carrier' | '3pl';

export async function createMember(db: Database, kind: MemberKind = 'shipper') {
  const [member] = await db
    .insert(members)
    .values({ name: `Test Member ${crypto.randomUUID().slice(0, 8)}`, kind, countryCode: 'ES' })
    .returning();
  if (!member) throw new Error('member insert returned no row');
  return member;
}

export async function createSite(db: Database, memberId: string, name = 'Test Site') {
  const [site] = await db
    .insert(sites)
    .values({
      memberId,
      name,
      addressLine: 'Calle Test 1',
      city: 'Madrid',
      countryCode: 'ES',
      location: { x: -3.7038, y: 40.4168 },
    })
    .returning();
  if (!site) throw new Error('site insert returned no row');
  return site;
}

export async function createMovement(
  db: Database,
  memberId: string,
  originSiteId: string,
  destinationSiteId: string,
) {
  const now = new Date();
  const [movement] = await db
    .insert(movements)
    .values({
      memberId,
      originSiteId,
      destinationSiteId,
      equipmentType: 'rigid-12t',
      massKg: '8000',
      pickupWindowStart: now,
      pickupWindowEnd: now,
      deliveryWindowStart: now,
      deliveryWindowEnd: now,
    })
    .returning();
  if (!movement) throw new Error('movement insert returned no row');
  return movement;
}

export async function createLeg(
  db: Database,
  memberId: string,
  originSiteId: string,
  destinationSiteId: string,
) {
  const [leg] = await db
    .insert(legs)
    .values({
      memberId,
      originSiteId,
      destinationSiteId,
      vehicleType: 'rigid-12t',
      fuelType: 'diesel',
      loadProfile: 'average',
      region: 'ES',
      distanceKm: '325',
      routingSource: 'TEST_ONLY',
      departureAt: new Date(),
    })
    .returning();
  if (!leg) throw new Error('leg insert returned no row');
  return leg;
}

export async function createMovementLeg(
  db: Database,
  movementId: string,
  legId: string,
  shipmentMassKg = '8000',
) {
  const [movementLeg] = await db
    .insert(movementLegs)
    .values({ movementId, legId, sequenceIndex: 0, shipmentMassKg, dataQuality: 'modelled' })
    .returning();
  if (!movementLeg) throw new Error('movement_leg insert returned no row');
  return movementLeg;
}
