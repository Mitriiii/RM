import { and, eq } from 'drizzle-orm';
import { withTenant, type Database } from './client.js';
import { sites } from './schema/index.js';

export interface SiteCoordinates {
  readonly longitude: number;
  readonly latitude: number;
}

export interface FindOrCreateSiteInput {
  readonly name: string;
  readonly city: string;
  readonly countryCode: string;
  readonly coordinates: SiteCoordinates;
}

/**
 * A capacity posting needs a `sites` row for its origin and destination, but `sites` is
 * tenant-scoped (RLS: member_id = current_member_id()) — one member's depot is not another's.
 * Rather than requiring a separate "manage your sites" step before a member can post capacity
 * at all, this finds the member's own existing site for a given city (by name) or creates one
 * on the fly, keyed on real, resolved coordinates the caller supplies (this function does no
 * geocoding itself — see apps/web/src/lib/diagnostic/gazetteer.ts for where those coordinates
 * come from upstream).
 */
export async function findOrCreateSite(
  db: Database,
  memberId: string,
  input: FindOrCreateSiteInput,
) {
  return withTenant(db, memberId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(sites)
      .where(and(eq(sites.memberId, memberId), eq(sites.name, input.name)));
    if (existing) return existing;

    const [created] = await tx
      .insert(sites)
      .values({
        memberId,
        name: input.name,
        addressLine: 'City centre',
        city: input.city,
        countryCode: input.countryCode,
        location: { x: input.coordinates.longitude, y: input.coordinates.latitude },
      })
      .returning();
    if (!created) throw new Error('findOrCreateSite: insert returned no row');
    return created;
  });
}
