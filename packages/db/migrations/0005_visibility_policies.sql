-- Concrete enforcement for CLAUDE.md's "member visibility permissions" hard constraint and
-- packages/matching's MatchContext.isVisible — previously an abstract injected callback with
-- no real backing data anywhere. See src/schema/memberVisibilityBlocks.ts.

-- member_visibility_blocks: a member can see and manage only the blocks they themselves
-- created (their own list of who they've hidden their postings from) — never another
-- member's block list, which would leak who has chosen to hide from whom.
ALTER TABLE member_visibility_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_visibility_blocks_owner_only ON member_visibility_blocks
  USING (owner_member_id = current_member_id())
  WITH CHECK (owner_member_id = current_member_id());
GRANT SELECT, INSERT, DELETE ON member_visibility_blocks TO freyo_tenant;

-- SECURITY DEFINER (owned by the migration role, bypasses RLS) so the capacity_postings
-- SELECT policy below can check whether p_owner_member_id has blocked p_viewer_member_id
-- without needing read access to the full member_visibility_blocks table — the same pattern
-- claims_ledger_chain() already uses to see across tenant boundaries safely. Returns true
-- (visible) whenever no block row exists, including when p_viewer_member_id is NULL (no
-- tenant context set) — matching current_member_id()'s own "match nothing, don't error"
-- behaviour rather than failing a query for an unauthenticated connection.
CREATE OR REPLACE FUNCTION member_visibility_allows(
  p_owner_member_id uuid,
  p_viewer_member_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM member_visibility_blocks
    WHERE owner_member_id = p_owner_member_id AND blocked_member_id = p_viewer_member_id
  )
$$;

GRANT EXECUTE ON FUNCTION member_visibility_allows(uuid, uuid) TO freyo_tenant;

-- capacity_postings: replace the previous unconditional "readable network-wide" policy with
-- one that still defaults to network-wide visibility (no block row = visible, unchanged
-- default behaviour) but now actually excludes a posting from a member the poster has
-- blocked — this is the one thing the old capacity_postings_select_all policy could not do.
DROP POLICY capacity_postings_select_all ON capacity_postings;
CREATE POLICY capacity_postings_select_visible ON capacity_postings
  FOR SELECT USING (member_visibility_allows(member_id, current_member_id()));
