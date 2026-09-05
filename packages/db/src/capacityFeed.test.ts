import { beforeAll, describe, expect, it } from 'vitest';
import {
  blockMemberVisibility,
  countOpenPostingsOnMemberLanes,
  listVisibleCapacityFeed,
  unblockMemberVisibility,
} from './capacityFeed.js';
import { withTenant } from './client.js';
import { memberVisibilityBlocks } from './schema/index.js';
import {
  seedCapacityPosting,
  createMember,
  createMovement,
  createSite,
} from './test-support/fixtures.js';
import { createAdminDb, createTenantDb, type TestConnection } from './test-support/testDb.js';

let admin: TestConnection;
let tenant: TestConnection;

beforeAll(() => {
  admin = createAdminDb();
  tenant = createTenantDb();
});

describe('capacity feed visibility', () => {
  it('a posting is visible to every member by default', async () => {
    const carrier = await createMember(admin.db, 'carrier');
    const shipper = await createMember(admin.db, 'shipper');
    const origin = await createSite(admin.db, carrier.id, 'Origin');
    const destination = await createSite(admin.db, carrier.id, 'Destination');
    await seedCapacityPosting(admin.db, carrier.id, origin.id, destination.id);

    const feed = await listVisibleCapacityFeed(tenant.db, shipper.id);
    expect(feed.some((posting) => posting.memberId === carrier.id)).toBe(true);
  });

  it('a member never sees a posting from a carrier who has blocked them', async () => {
    const carrier = await createMember(admin.db, 'carrier');
    const blockedShipper = await createMember(admin.db, 'shipper');
    const otherShipper = await createMember(admin.db, 'shipper');
    const origin = await createSite(admin.db, carrier.id, 'Origin');
    const destination = await createSite(admin.db, carrier.id, 'Destination');
    const posting = await seedCapacityPosting(admin.db, carrier.id, origin.id, destination.id);

    await blockMemberVisibility(tenant.db, carrier.id, blockedShipper.id);

    const feedForBlocked = await listVisibleCapacityFeed(tenant.db, blockedShipper.id);
    expect(feedForBlocked.some((p) => p.id === posting.id)).toBe(false);

    // The block is specific to blockedShipper — everyone else still sees the posting.
    const feedForOther = await listVisibleCapacityFeed(tenant.db, otherShipper.id);
    expect(feedForOther.some((p) => p.id === posting.id)).toBe(true);
  });

  it('unblocking restores visibility', async () => {
    const carrier = await createMember(admin.db, 'carrier');
    const shipper = await createMember(admin.db, 'shipper');
    const origin = await createSite(admin.db, carrier.id, 'Origin');
    const destination = await createSite(admin.db, carrier.id, 'Destination');
    const posting = await seedCapacityPosting(admin.db, carrier.id, origin.id, destination.id);

    await blockMemberVisibility(tenant.db, carrier.id, shipper.id);
    expect(
      (await listVisibleCapacityFeed(tenant.db, shipper.id)).some((p) => p.id === posting.id),
    ).toBe(false);

    await unblockMemberVisibility(tenant.db, carrier.id, shipper.id);
    expect(
      (await listVisibleCapacityFeed(tenant.db, shipper.id)).some((p) => p.id === posting.id),
    ).toBe(true);
  });

  it("a member cannot create a visibility block on another member's behalf", async () => {
    const carrier = await createMember(admin.db, 'carrier');
    const attacker = await createMember(admin.db, 'shipper');
    const victim = await createMember(admin.db, 'shipper');

    // attacker tries to insert a block row claiming carrier as the owner, but runs it under
    // their own tenant context — RLS's WITH CHECK must reject this since owner_member_id
    // must equal current_member_id(), which is attacker.id, not carrier.id.
    await expect(
      withTenant(tenant.db, attacker.id, (tx) =>
        tx.insert(memberVisibilityBlocks).values({
          ownerMemberId: carrier.id,
          blockedMemberId: victim.id,
        }),
      ),
    ).rejects.toThrow();
  });

  it('counts open postings only on lanes the viewing member actually runs, never a vanity number', async () => {
    // freyo_test is a shared, persistent database across test runs (never truncated between
    // them) — real city names like "Madrid" would collide with leftover rows from earlier
    // runs and inflate this count. A per-test random suffix keeps this test's lane unique to
    // itself regardless of what else is sitting in the database.
    const suffix = crypto.randomUUID().slice(0, 8);
    const cityA = `Madrid-${suffix}`;
    const cityB = `Zaragoza-${suffix}`;
    const unrelatedCityA = `Valencia-${suffix}`;
    const unrelatedCityB = `Barcelona-${suffix}`;

    const carrier = await createMember(admin.db, 'carrier');
    const shipper = await createMember(admin.db, 'shipper');
    const shipperOrigin = await createSite(admin.db, shipper.id, 'Shipper origin', cityA);
    const shipperDestination = await createSite(admin.db, shipper.id, 'Shipper destination', cityB);
    // Different member, so real site ids differ from the shipper's — but the *carrier's*
    // posting for the same real corridor is keyed on city name, so it still counts.
    const carrierOrigin = await createSite(admin.db, carrier.id, 'Carrier origin', cityA);
    const carrierDestination = await createSite(admin.db, carrier.id, 'Carrier destination', cityB);
    const unrelatedOrigin = await createSite(admin.db, carrier.id, 'Unrelated origin', unrelatedCityA);
    const unrelatedDestination = await createSite(
      admin.db,
      carrier.id,
      'Unrelated destination',
      unrelatedCityB,
    );

    // shipper has moved cityA -> cityB before (a lane they run).
    await createMovement(admin.db, shipper.id, shipperOrigin.id, shipperDestination.id);

    // One open posting on the same real corridor (cityA <-> cityB, carrier's own site rows),
    // one on a lane the shipper has never touched.
    await seedCapacityPosting(admin.db, carrier.id, carrierOrigin.id, carrierDestination.id, {
      originCity: cityA,
      destinationCity: cityB,
    });
    await seedCapacityPosting(admin.db, carrier.id, unrelatedOrigin.id, unrelatedDestination.id, {
      originCity: unrelatedCityA,
      destinationCity: unrelatedCityB,
    });

    const count = await countOpenPostingsOnMemberLanes(tenant.db, shipper.id);
    expect(count).toBe(1);
  });

  it('counts a posting running the *reverse* direction of a lane the member runs — an empty return leg is the same corridor, not a different one', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const cityA = `Madrid-${suffix}`;
    const cityB = `Barcelona-${suffix}`;

    const carrier = await createMember(admin.db, 'carrier');
    const shipper = await createMember(admin.db, 'shipper');
    const shipperCityA = await createSite(admin.db, shipper.id, 'A (shipper)', cityA);
    const shipperCityB = await createSite(admin.db, shipper.id, 'B (shipper)', cityB);
    const carrierCityB = await createSite(admin.db, carrier.id, 'B (carrier)', cityB);
    const carrierCityA = await createSite(admin.db, carrier.id, 'A (carrier)', cityA);

    // shipper ships cityA -> cityB; the carrier's posting is the empty return leg, cityB ->
    // cityA, using the carrier's own (different) site rows for the same cities.
    await createMovement(admin.db, shipper.id, shipperCityA.id, shipperCityB.id);
    await seedCapacityPosting(admin.db, carrier.id, carrierCityB.id, carrierCityA.id, {
      originCity: cityB,
      destinationCity: cityA,
    });

    const count = await countOpenPostingsOnMemberLanes(tenant.db, shipper.id);
    expect(count).toBe(1);
  });

  it('is honestly zero for a member who runs no lanes with open postings', async () => {
    const freshMember = await createMember(admin.db, 'shipper');
    const count = await countOpenPostingsOnMemberLanes(tenant.db, freshMember.id);
    expect(count).toBe(0);
  });
});
