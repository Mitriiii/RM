import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from './client.js';
import { emissionRecords } from './schema/index.js';
import {
  createLeg,
  createMember,
  createMovement,
  createMovementLeg,
  createSite,
} from './test-support/fixtures.js';
import { createAdminDb, createTenantDb, type TestConnection } from './test-support/testDb.js';

let admin: TestConnection;
let tenant: TestConnection;
let memberId: string;
let recordId: string;
let movementId: string;
let movementLegId: string;

beforeAll(async () => {
  admin = createAdminDb();
  tenant = createTenantDb();

  const member = await createMember(admin.db, 'shipper');
  memberId = member.id;
  const origin = await createSite(admin.db, memberId, 'Origin');
  const destination = await createSite(admin.db, memberId, 'Destination');
  const movement = await createMovement(admin.db, memberId, origin.id, destination.id);
  const leg = await createLeg(admin.db, memberId, origin.id, destination.id);
  const movementLeg = await createMovementLeg(admin.db, movement.id, leg.id);
  movementId = movement.id;
  movementLegId = movementLeg.id;

  const [record] = await admin.db
    .insert(emissionRecords)
    .values({
      memberId,
      movementId: movement.id,
      movementLegId: movementLeg.id,
      vehicleType: 'rigid-12t',
      fuelType: 'diesel',
      loadProfile: 'average',
      region: 'ES',
      distanceKm: '325',
      routingSource: 'TEST_ONLY',
      dataQuality: 'modelled',
      shipmentMassKg: '8000',
      legTotalMassKg: '8000',
      allocationShare: 1,
      factorSetSource: 'TEST_ONLY',
      factorSetVersion: '0',
      factorSetEffectiveDate: '2020-01-01',
      gwpSet: 'TEST_ONLY-GWP',
      engineVersion: '0.1.0',
      wellToTankGrams: '39000',
      tankToWheelGrams: '221000',
      wellToWheelGrams: '260000',
    })
    .returning();
  if (!record) throw new Error('setup insert failed');
  recordId = record.id;
});

afterAll(async () => {
  await admin.close();
  await tenant.close();
});

describe('emission_records is append-only', () => {
  // The tenant-scoped app role has no UPDATE/DELETE grant at all on this table (see
  // migrations/0001_policies.sql), so it never even reaches the trigger — Postgres rejects
  // the statement at the privilege check first. That's a stronger guarantee than the
  // trigger alone, not a different one; the admin-role tests below confirm the trigger is
  // what backs it up for any role that *does* have the privilege.
  it('rejects UPDATE from the tenant-scoped app role at the grant level', async () => {
    await expect(
      withTenant(tenant.db, memberId, (tx) =>
        tx
          .update(emissionRecords)
          .set({ wellToWheelGrams: '999999' })
          .where(eq(emissionRecords.id, recordId)),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('rejects DELETE from the tenant-scoped app role at the grant level', async () => {
    await expect(
      withTenant(tenant.db, memberId, (tx) =>
        tx.delete(emissionRecords).where(eq(emissionRecords.id, recordId)),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('rejects UPDATE even from the table-owning admin role — the trigger has no exception for ownership', async () => {
    await expect(
      admin.db
        .update(emissionRecords)
        .set({ wellToWheelGrams: '1' })
        .where(eq(emissionRecords.id, recordId)),
    ).rejects.toThrow(/append-only/i);
  });

  it('a correction is a new row referencing supersedesId, and the original is untouched', async () => {
    const [correction] = await admin.db
      .insert(emissionRecords)
      .values({
        memberId,
        movementId,
        movementLegId,
        vehicleType: 'rigid-12t',
        fuelType: 'diesel',
        loadProfile: 'average',
        region: 'ES',
        distanceKm: '325',
        routingSource: 'TEST_ONLY',
        dataQuality: 'primary',
        shipmentMassKg: '8000',
        legTotalMassKg: '8000',
        allocationShare: 1,
        factorSetSource: 'TEST_ONLY',
        factorSetVersion: '0',
        factorSetEffectiveDate: '2020-01-01',
        gwpSet: 'TEST_ONLY-GWP',
        engineVersion: '0.1.0',
        wellToTankGrams: '38500',
        tankToWheelGrams: '220000',
        wellToWheelGrams: '258500',
        supersedesId: recordId,
      })
      .returning();
    if (!correction) throw new Error('setup insert failed');

    expect(correction.supersedesId).toBe(recordId);

    const original = await admin.db
      .select()
      .from(emissionRecords)
      .where(eq(emissionRecords.id, recordId));
    expect(original[0]?.wellToWheelGrams).toBe('260000.0000');
  });
});
