import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant, type Database } from './client.js';
import { capacityPostings, emissionRecords, members, movements } from './schema/index.js';
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
let memberA: Awaited<ReturnType<typeof createMember>>;
let memberB: Awaited<ReturnType<typeof createMember>>;
let movementA: Awaited<ReturnType<typeof createMovement>>;
let movementB: Awaited<ReturnType<typeof createMovement>>;

async function asTenant<T>(memberId: string, fn: (tx: Database) => Promise<T>): Promise<T> {
  return withTenant(tenant.db, memberId, fn);
}

beforeAll(async () => {
  admin = createAdminDb();
  tenant = createTenantDb();

  memberA = await createMember(admin.db, 'shipper');
  memberB = await createMember(admin.db, 'shipper');

  const siteA1 = await createSite(admin.db, memberA.id, 'A origin');
  const siteA2 = await createSite(admin.db, memberA.id, 'A destination');
  const siteB1 = await createSite(admin.db, memberB.id, 'B origin');
  const siteB2 = await createSite(admin.db, memberB.id, 'B destination');

  movementA = await createMovement(admin.db, memberA.id, siteA1.id, siteA2.id);
  movementB = await createMovement(admin.db, memberB.id, siteB1.id, siteB2.id);
});

afterAll(async () => {
  await admin.close();
  await tenant.close();
});

describe('cross-tenant isolation on movements', () => {
  it('a tenant sees only their own rows in an unfiltered SELECT', async () => {
    const rowsAsA = await asTenant(memberA.id, (tx) => tx.select().from(movements));
    expect(rowsAsA.map((r) => r.id)).toEqual([movementA.id]);

    const rowsAsB = await asTenant(memberB.id, (tx) => tx.select().from(movements));
    expect(rowsAsB.map((r) => r.id)).toEqual([movementB.id]);
  });

  it("a tenant querying another tenant's row by id gets zero rows, not a permission error", async () => {
    const result = await asTenant(memberB.id, (tx) =>
      tx.select().from(movements).where(eq(movements.id, movementA.id)),
    );
    expect(result).toEqual([]);
  });

  it('a tenant cannot insert a row claiming to belong to a different member', async () => {
    const now = new Date();
    const siteForA = await createSite(admin.db, memberA.id, 'A extra site');

    await expect(
      asTenant(memberA.id, (tx) =>
        tx.insert(movements).values({
          memberId: memberB.id, // attempting to write as if it were member B's movement
          originSiteId: siteForA.id,
          destinationSiteId: siteForA.id,
          equipmentType: 'rigid-12t',
          massKg: '1000',
          pickupWindowStart: now,
          pickupWindowEnd: now,
          deliveryWindowStart: now,
          deliveryWindowEnd: now,
        }),
      ),
    ).rejects.toThrow();
  });

  it('a connection with no tenant set sees no tenant-owned rows at all', async () => {
    // No withTenant() wrapper — app.current_member_id is unset on this connection.
    const rows = await tenant.db.select().from(movements);
    expect(rows).toEqual([]);
  });
});

describe('cross-tenant isolation end-to-end through the emission_records FK graph', () => {
  it('member A cannot see an emission record belonging to member B', async () => {
    const siteA1 = await createSite(admin.db, memberA.id, 'A leg origin');
    const siteA2 = await createSite(admin.db, memberA.id, 'A leg destination');
    const legB = await createLeg(admin.db, memberB.id, siteA1.id, siteA2.id);
    const movementLegB = await createMovementLeg(admin.db, movementB.id, legB.id);

    const [record] = await admin.db
      .insert(emissionRecords)
      .values({
        memberId: memberB.id,
        movementId: movementB.id,
        movementLegId: movementLegB.id,
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

    const asA = await asTenant(memberA.id, (tx) => tx.select().from(emissionRecords));
    expect(asA).toEqual([]);

    const asB = await asTenant(memberB.id, (tx) => tx.select().from(emissionRecords));
    expect(asB.map((r) => r.id)).toEqual([record.id]);
  });
});

describe('intentional exceptions to per-tenant isolation', () => {
  it('members is readable network-wide — the Exchange cannot work otherwise', async () => {
    const rows = await asTenant(memberA.id, (tx) => tx.select().from(members));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(memberA.id);
    expect(ids).toContain(memberB.id);
  });

  it('a capacity posting is readable by every member but writable only by its owner', async () => {
    const siteA1 = await createSite(admin.db, memberA.id, 'Posting origin');
    const siteA2 = await createSite(admin.db, memberA.id, 'Posting destination');
    const now = new Date();
    const [posting] = await asTenant(memberA.id, (tx) =>
      tx
        .insert(capacityPostings)
        .values({
          memberId: memberA.id,
          originSiteId: siteA1.id,
          destinationSiteId: siteA2.id,
          vehicleType: 'articulated-40t',
          availableFrom: now,
          availableUntil: now,
          capacityKg: '20000',
        })
        .returning(),
    );
    if (!posting) throw new Error('setup insert failed');

    const seenByB = await asTenant(memberB.id, (tx) =>
      tx.select().from(capacityPostings).where(eq(capacityPostings.id, posting.id)),
    );
    expect(seenByB).toHaveLength(1);

    const updateByB = await asTenant(memberB.id, (tx) =>
      tx
        .update(capacityPostings)
        .set({ status: 'withdrawn' })
        .where(eq(capacityPostings.id, posting.id))
        .returning(),
    );
    expect(updateByB).toEqual([]);

    const stillOpen = await admin.db
      .select()
      .from(capacityPostings)
      .where(eq(capacityPostings.id, posting.id));
    expect(stillOpen[0]?.status).toBe('open');
  });
});
