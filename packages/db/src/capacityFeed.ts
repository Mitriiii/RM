import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { withTenant, type Database } from './client.js';
import {
  capacityPostings,
  legs,
  memberVisibilityBlocks,
  members,
  movements,
  sites,
} from './schema/index.js';

const originSites = alias(sites, 'origin_sites');
const destinationSites = alias(sites, 'destination_sites');

export interface CreateCapacityPostingInput {
  readonly originSiteId: string;
  readonly originCity: string;
  readonly destinationSiteId: string;
  readonly destinationCity: string;
  readonly vehicleType: string;
  readonly temperatureClass: 'ambient' | 'chilled' | 'frozen';
  readonly adrClasses: readonly string[];
  readonly availableFrom: Date;
  readonly availableUntil: Date;
  readonly capacityKg: number;
  readonly capacityLoadingMetres: number;
}

/**
 * Declares a truck available on a route and time window. Deliberately has no price, rate, or
 * cost-to-carrier field in its input type — see CLAUDE.md and the "pooling network" kickoff's
 * guardrails. Runs as the posting member's own tenant, so RLS's
 * capacity_postings_insert_own policy is what actually enforces "writable only by the owning
 * carrier" — this function does not additionally check that itself.
 */
export async function createCapacityPosting(
  db: Database,
  memberId: string,
  input: CreateCapacityPostingInput,
) {
  return withTenant(db, memberId, async (tx) => {
    const [posting] = await tx
      .insert(capacityPostings)
      .values({
        memberId,
        originSiteId: input.originSiteId,
        originCity: input.originCity,
        destinationSiteId: input.destinationSiteId,
        destinationCity: input.destinationCity,
        vehicleType: input.vehicleType,
        temperatureClass: input.temperatureClass,
        adrClasses: [...input.adrClasses],
        availableFrom: input.availableFrom,
        availableUntil: input.availableUntil,
        capacityKg: String(input.capacityKg),
        capacityLoadingMetres: String(input.capacityLoadingMetres),
      })
      .returning();
    if (!posting) throw new Error('createCapacityPosting: insert returned no row');
    return posting;
  });
}

/**
 * Every open posting visible to `viewerMemberId` — visibility is enforced by
 * migrations/0005_visibility_policies.sql's capacity_postings_select_visible RLS policy, not
 * by this function; running the query as the viewer's own tenant is what makes that policy
 * apply. This is the one query the live capacity feed UI reads from.
 */
export async function listVisibleCapacityFeed(db: Database, viewerMemberId: string) {
  return withTenant(db, viewerMemberId, (tx) =>
    tx
      .select({
        id: capacityPostings.id,
        memberId: capacityPostings.memberId,
        memberName: members.name,
        originCity: capacityPostings.originCity,
        destinationCity: capacityPostings.destinationCity,
        vehicleType: capacityPostings.vehicleType,
        temperatureClass: capacityPostings.temperatureClass,
        adrClasses: capacityPostings.adrClasses,
        availableFrom: capacityPostings.availableFrom,
        availableUntil: capacityPostings.availableUntil,
        capacityKg: capacityPostings.capacityKg,
        capacityLoadingMetres: capacityPostings.capacityLoadingMetres,
      })
      .from(capacityPostings)
      .innerJoin(members, eq(members.id, capacityPostings.memberId))
      .where(eq(capacityPostings.status, 'open'))
      .orderBy(asc(capacityPostings.availableFrom)),
  );
}

/**
 * Hides `ownerMemberId`'s own postings from `blockedMemberId`. Runs as ownerMemberId's own
 * tenant so member_visibility_blocks_owner_only's RLS policy (owner_member_id =
 * current_member_id()) is what actually enforces "only the owner can create their own
 * blocks" — a member can never block on someone else's behalf.
 */
export async function blockMemberVisibility(
  db: Database,
  ownerMemberId: string,
  blockedMemberId: string,
) {
  return withTenant(db, ownerMemberId, (tx) =>
    tx
      .insert(memberVisibilityBlocks)
      .values({ ownerMemberId, blockedMemberId })
      .onConflictDoNothing()
      .returning(),
  );
}

export async function unblockMemberVisibility(
  db: Database,
  ownerMemberId: string,
  blockedMemberId: string,
) {
  return withTenant(db, ownerMemberId, (tx) =>
    tx
      .delete(memberVisibilityBlocks)
      .where(
        and(
          eq(memberVisibilityBlocks.ownerMemberId, ownerMemberId),
          eq(memberVisibilityBlocks.blockedMemberId, blockedMemberId),
        ),
      ),
  );
}

/**
 * A lane key by *city name*, not site id, and treating A→B and B→A as the same lane. Both
 * matter: sites are tenant-private (RLS: member_id = current_member_id()), so a carrier's own
 * "Madrid" site row and a shipper's own "Madrid" site row are different rows with different
 * ids — matching by site id would never connect them, even though they're the same real
 * place. City name is the real shared identifier two different members' rows can agree on.
 * Direction-agnostic because a shipper's outbound movement (Madrid→Barcelona) and a carrier's
 * open posting for the empty return leg (Barcelona→Madrid) point opposite ways but describe
 * the exact corridor this product exists to pool.
 */
function laneKey(cityA: string, cityB: string): string {
  return [cityA.trim().toLowerCase(), cityB.trim().toLowerCase()].sort().join('|');
}

function lanesFromRows(rows: readonly { city: string; destinationCity: string }[]) {
  return new Set(rows.map((row) => laneKey(row.city, row.destinationCity)));
}

/**
 * "N open postings on lanes you run" — a real, live count, not a vanity metric (see the
 * "pooling network" kickoff's Session 9 spec). A member "runs" a lane if they've moved
 * shipments on it (as a shipper, movements) or hauled it (as a carrier, legs); both are
 * checked since a member can be either kind, matched by city name in either direction (see
 * laneKey above). Deliberately does not invent a bigger number: zero is a real, honestly-
 * displayed answer for a young network — see the UI layer's empty state, not this function,
 * for how that's communicated.
 */
export async function countOpenPostingsOnMemberLanes(
  db: Database,
  viewerMemberId: string,
): Promise<number> {
  return withTenant(db, viewerMemberId, async (tx) => {
    const [movementLanes, legLanes, openPostings] = await Promise.all([
      tx
        .select({ city: originSites.city, destinationCity: destinationSites.city })
        .from(movements)
        .innerJoin(originSites, eq(originSites.id, movements.originSiteId))
        .innerJoin(destinationSites, eq(destinationSites.id, movements.destinationSiteId)),
      tx
        .select({ city: originSites.city, destinationCity: destinationSites.city })
        .from(legs)
        .innerJoin(originSites, eq(originSites.id, legs.originSiteId))
        .innerJoin(destinationSites, eq(destinationSites.id, legs.destinationSiteId)),
      tx
        .select({
          originCity: capacityPostings.originCity,
          destinationCity: capacityPostings.destinationCity,
        })
        .from(capacityPostings)
        .where(eq(capacityPostings.status, 'open')),
    ]);

    const lanesRun = new Set([...lanesFromRows(movementLanes), ...lanesFromRows(legLanes)]);
    return openPostings.filter((posting) =>
      lanesRun.has(laneKey(posting.originCity, posting.destinationCity)),
    ).length;
  });
}
