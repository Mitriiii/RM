# 0010 — Capacity posting and the live pairing feed: a real visibility mechanism, a dev-only identity, and city-based lane matching

## Context

The "pooling network" kickoff's Session 9 asked for the first UI built on top of
`capacity_postings`/`pairings` — a posting form, a live feed respecting "the existing
visibility-permission hard constraint," and an honest liquidity indicator. Three things the
session's own text assumed already existed turned out not to, each requiring a real decision
before any of it could be built truthfully.

## Decisions

**There was no "logged-in member" concept anywhere in this codebase.** Every screen built so
far (diagnostic, calculator) is anonymous. Capacity postings are inherently per-member, so
this was a blocking gap, not a detail. Per explicit user direction, added a dev-only "acting
as" switcher (`apps/web/src/lib/devMember.ts`, `components/DevMemberSwitcher.tsx`): a cookie
naming which real, seeded member the current browser session acts as, always rendered with a
visible amber "Dev: acting as" label so it can never be mistaken for real authentication. Row-
level security is still enforced for real, server-side, against whichever member id the
cookie names — the cookie only selects _which_ tenant context a request runs under; it grants
no access itself. Real authentication remains a prerequisite for production, tracked as a gap,
not solved here.

**"Member visibility permissions" was an abstract callback with no real data behind it
anywhere.** `packages/matching`'s `checkMemberVisibility` already took an injected `isVisible`
function — correct dependency-injection design, but nothing had ever implemented it; the
existing `capacity_postings_select_all` RLS policy was `USING (true)`, unconditionally
network-wide. Since CLAUDE.md names "member visibility permissions" as one of the matcher's
own hard constraints, and the kickoff explicitly requires a test proving exclusion, built the
concrete mechanism: `member_visibility_blocks` (one row = "ownerMemberId hides their postings
from blockedMemberId"), a `SECURITY DEFINER` function (`member_visibility_allows`, mirroring
`claims_ledger_chain()`'s existing pattern for safely checking across tenant boundaries) so
the `capacity_postings` SELECT policy can check for a block without granting broad read access
to the block-list table itself, and a rewritten `capacity_postings_select_visible` policy
enforcing it at the database layer — not just in application code, per CLAUDE.md's
non-negotiable #5 spirit even though that non-negotiable is written about tenant isolation
specifically. Default behaviour (no block row) is unchanged: full network visibility, exactly
matching the schema's original "a posting exists to be found" comment.
`packages/db/src/capacityFeed.test.ts` proves a blocked member sees nothing from the blocker,
an unrelated member still does, and unblocking restores visibility.

**A capacity posting needs `sites` rows, but `sites` is tenant-private — so a naive design
would require a "manage your sites" step before anyone could post at all.** Rather than build
that separate flow, `packages/db/src/sites.ts`'s `findOrCreateSite` lazily creates a member's
own site row for a city the first time they reference it, keyed on real, resolved coordinates
the caller supplies (the existing Spanish-city gazetteer already used by the diagnostic,
`apps/web/src/lib/diagnostic/gazetteer.ts` — no new geocoding, no invented coordinates). This
keeps the posting form to a city-name dropdown, completable quickly, while still respecting
the real tenant-scoped schema.

**Lane-matching for the liquidity indicator has to be by city name, not site id, and direction-
agnostic.** Two bugs, caught by testing against realistic data rather than one member's own
fixtures: (1) since every member gets their _own_ site row per city, matching
`countOpenPostingsOnMemberLanes` by site id could never connect a carrier's "Madrid" to a
shipper's separately-created "Madrid" — the same real place, different rows. Fixed by
denormalizing `originCity`/`destinationCity` (plain text, non-sensitive) directly onto
`capacity_postings` — the same rationale `pairings` already uses for denormalizing
`carrierMemberId`/`shipperMemberId`, applied here for the same reason. (2) A shipper's outbound
movement (Madrid→Barcelona) and a carrier's open posting for the empty return leg
(Barcelona→Madrid) point opposite directions but describe the exact corridor this product
exists to pool; direction-only matching made the indicator read near-zero for the most common
real case. `laneKey` now sorts the city pair before comparing, so either direction counts as
the same lane. Both fixes are covered by tests that would have caught the bug the first design
missed.

## Consequences

- The dev member switcher must be replaced by real authentication before any production
  deployment — everything downstream (this session and 9.1–9.3) currently trusts a
  client-supplied cookie for identity, which is fine for local development and reviewable
  demos only.
- No UI exists yet for a member to actually _create_ a visibility block (only the data layer
  and its tests) — Session 9 asked for the feed to respect blocks that exist, not for a
  settings page to manage them. A "manage who sees my postings" screen is a natural, separate
  follow-up.
- `capacity_postings` now denormalizes city names; any future query that needs the _precise_
  site (address, coordinates) still has to join through `originSiteId`/`destinationSiteId` as
  before — the new columns are for cross-member display and matching only, not a replacement
  for the site relationship.
- `FactorSet`-style enumeration and city-based lane matching are both instances of the same
  lesson: a lookup keyed on a tenant-private id will quietly fail to connect two different
  members' rows describing the same real thing. Any future cross-member matching logic in
  this codebase should default to suspecting this, not assume ids compose across tenants.
