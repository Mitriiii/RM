import { beforeAll, describe, expect, it } from 'vitest';
import { findOrCreateSite } from './sites.js';
import { createMember } from './test-support/fixtures.js';
import { createAdminDb, createTenantDb, type TestConnection } from './test-support/testDb.js';

let admin: TestConnection;
let tenant: TestConnection;

beforeAll(() => {
  admin = createAdminDb();
  tenant = createTenantDb();
});

describe('findOrCreateSite', () => {
  it('creates a site the first time a member posts from a given city', async () => {
    const member = await createMember(admin.db, 'carrier');
    const site = await findOrCreateSite(tenant.db, member.id, {
      name: 'Madrid',
      city: 'Madrid',
      countryCode: 'ES',
      coordinates: { longitude: -3.7038, latitude: 40.4168 },
    });
    expect(site.memberId).toBe(member.id);
    expect(site.city).toBe('Madrid');
  });

  it('reuses the same site on a second call for the same member and city', async () => {
    const member = await createMember(admin.db, 'carrier');
    const first = await findOrCreateSite(tenant.db, member.id, {
      name: 'Barcelona',
      city: 'Barcelona',
      countryCode: 'ES',
      coordinates: { longitude: 2.1686, latitude: 41.3874 },
    });
    const second = await findOrCreateSite(tenant.db, member.id, {
      name: 'Barcelona',
      city: 'Barcelona',
      countryCode: 'ES',
      coordinates: { longitude: 2.1686, latitude: 41.3874 },
    });
    expect(second.id).toBe(first.id);
  });

  it('never reuses a site belonging to a different member', async () => {
    const memberA = await createMember(admin.db, 'carrier');
    const memberB = await createMember(admin.db, 'carrier');
    const siteA = await findOrCreateSite(tenant.db, memberA.id, {
      name: 'Valencia',
      city: 'Valencia',
      countryCode: 'ES',
      coordinates: { longitude: -0.3763, latitude: 39.4699 },
    });
    const siteB = await findOrCreateSite(tenant.db, memberB.id, {
      name: 'Valencia',
      city: 'Valencia',
      countryCode: 'ES',
      coordinates: { longitude: -0.3763, latitude: 39.4699 },
    });
    expect(siteB.id).not.toBe(siteA.id);
  });
});
