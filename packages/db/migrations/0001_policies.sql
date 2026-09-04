-- Row-level security, append-only enforcement, and the claims ledger's hash chain.
--
-- Role model: this migration is applied by the role that owns every table it creates (the
-- role named in DATABASE_URL when `db:migrate` runs — `freyo` in local dev). A table owner
-- bypasses its own row-level security by default in Postgres unless FORCE ROW LEVEL SECURITY
-- is set, which we deliberately do not set. `freyo_tenant`, created below, owns nothing —
-- every policy in this file actually applies to it. The application and every RLS-sensitive
-- test must connect as `freyo_tenant` (or an equivalent non-owner role), never as the
-- migration owner, or row-level security is silently inert. See packages/db/README.md.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'freyo_tenant') THEN
    CREATE ROLE freyo_tenant WITH LOGIN PASSWORD 'freyo_tenant';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO freyo_tenant;
GRANT USAGE ON SCHEMA cost TO freyo_tenant;

-- Reads `app.current_member_id`, set per-transaction by packages/db's withTenant() via
-- set_config(). Returns NULL (matching nothing) when unset, rather than erroring, so a
-- connection with no tenant set simply sees no tenant-owned rows instead of failing loudly
-- mid-query.
CREATE OR REPLACE FUNCTION current_member_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_member_id', true), '')::uuid
$$;

GRANT EXECUTE ON FUNCTION current_member_id() TO freyo_tenant;

-- members, factor_sets ------------------------------------------------------------------
-- No row-level security: both are shared reference data, not a member's private
-- information (see src/schema/members.ts and src/schema/factorSets.ts for why). Writable
-- only by the migration/admin role — freyo_tenant gets read access only.
GRANT SELECT ON members TO freyo_tenant;
GRANT SELECT ON factor_sets TO freyo_tenant;

-- users -----------------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (member_id = current_member_id())
  WITH CHECK (member_id = current_member_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO freyo_tenant;

-- sites -----------------------------------------------------------------------------------
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY sites_tenant_isolation ON sites
  USING (member_id = current_member_id())
  WITH CHECK (member_id = current_member_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON sites TO freyo_tenant;

-- movements -------------------------------------------------------------------------------
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY movements_tenant_isolation ON movements
  USING (member_id = current_member_id())
  WITH CHECK (member_id = current_member_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON movements TO freyo_tenant;

-- legs ------------------------------------------------------------------------------------
ALTER TABLE legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY legs_tenant_isolation ON legs
  USING (member_id = current_member_id())
  WITH CHECK (member_id = current_member_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON legs TO freyo_tenant;

-- movement_legs -----------------------------------------------------------------------------
-- Visible to either party on a shared leg: the movement's shipper, or the leg's carrier.
-- Each EXISTS clause filters by member_id explicitly, so this is correct regardless of
-- whether the referenced movements/legs row would independently be visible under their own
-- policies to the calling role.
ALTER TABLE movement_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY movement_legs_party_visibility ON movement_legs
  USING (
    EXISTS (
      SELECT 1 FROM movements m WHERE m.id = movement_legs.movement_id AND m.member_id = current_member_id()
    )
    OR EXISTS (
      SELECT 1 FROM legs l WHERE l.id = movement_legs.leg_id AND l.member_id = current_member_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM movements m WHERE m.id = movement_legs.movement_id AND m.member_id = current_member_id()
    )
    OR EXISTS (
      SELECT 1 FROM legs l WHERE l.id = movement_legs.leg_id AND l.member_id = current_member_id()
    )
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON movement_legs TO freyo_tenant;

-- capacity_postings -------------------------------------------------------------------------
-- A posting exists to be found: readable network-wide by design (see
-- src/schema/capacityPostings.ts), writable only by the owning carrier.
ALTER TABLE capacity_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY capacity_postings_select_all ON capacity_postings FOR SELECT USING (true);
CREATE POLICY capacity_postings_insert_own ON capacity_postings
  FOR INSERT WITH CHECK (member_id = current_member_id());
CREATE POLICY capacity_postings_update_own ON capacity_postings
  FOR UPDATE USING (member_id = current_member_id()) WITH CHECK (member_id = current_member_id());
CREATE POLICY capacity_postings_delete_own ON capacity_postings
  FOR DELETE USING (member_id = current_member_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON capacity_postings TO freyo_tenant;

-- pairings ------------------------------------------------------------------------------------
-- carrierMemberId/shipperMemberId are denormalized onto the row precisely so this policy
-- doesn't need to join out to capacity_postings/movements.
ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;
CREATE POLICY pairings_party_visibility ON pairings
  USING (carrier_member_id = current_member_id() OR shipper_member_id = current_member_id())
  WITH CHECK (carrier_member_id = current_member_id() OR shipper_member_id = current_member_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON pairings TO freyo_tenant;

-- emission_records: tenant-scoped, append-only -------------------------------------------
ALTER TABLE emission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY emission_records_tenant_isolation ON emission_records
  USING (member_id = current_member_id())
  WITH CHECK (member_id = current_member_id());
-- No UPDATE/DELETE grant at all — belt-and-suspenders alongside the trigger below, which is
-- the actual, unconditional enforcement (grants alone would still let the table owner
-- mutate rows; the trigger does not make that exception).
GRANT SELECT, INSERT ON emission_records TO freyo_tenant;

CREATE OR REPLACE FUNCTION reject_emission_record_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'emission_records is append-only: % is not allowed. Insert a new row with supersedes_id set instead.',
    TG_OP;
END;
$$;

CREATE TRIGGER emission_records_append_only
  BEFORE UPDATE OR DELETE ON emission_records
  FOR EACH ROW EXECUTE FUNCTION reject_emission_record_mutation();

-- claims_ledger: tenant-scoped reads, one global hash chain, append-only -----------------
-- The chain is one shared ledger across every member, not one per member: preventing two
-- members from claiming the same avoided kilometre requires a single canonical order. Row-
-- level security still scopes ordinary SELECT/INSERT to ownerMemberId — only
-- verify_claims_chain() below sees the whole chain.
ALTER TABLE claims_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY claims_ledger_tenant_isolation ON claims_ledger
  USING (owner_member_id = current_member_id())
  WITH CHECK (owner_member_id = current_member_id());
GRANT SELECT, INSERT ON claims_ledger TO freyo_tenant;

-- Pure, deterministic hash of one row's content plus the hash it chains from. Shared by the
-- insert-time trigger and the verification function below so they can never drift apart.
-- Timestamps are normalized to UTC text explicitly (never cast bare, which would depend on
-- the calling session's `timezone` setting and produce false tamper positives across
-- sessions with different zones).
CREATE OR REPLACE FUNCTION claims_ledger_row_signature(
  p_prev_hash text,
  p_id uuid,
  p_owner_member_id uuid,
  p_co2e_grams numeric,
  p_payload jsonb,
  p_created_at timestamptz
) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(
    digest(
      coalesce(p_prev_hash, '') || '|' ||
      p_id::text || '|' ||
      p_owner_member_id::text || '|' ||
      p_co2e_grams::text || '|' ||
      p_payload::text || '|' ||
      to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'sha256'
    ),
    'hex'
  )
$$;

-- SECURITY DEFINER (owned by the migration role) so its lookup of the chain's current tail
-- sees every member's rows, not just the inserting tenant's own — without this, each tenant
-- would only ever see their own prior rows under their own RLS policy, silently splitting
-- one global chain into an undetected per-tenant one.
CREATE OR REPLACE FUNCTION claims_ledger_chain() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  previous_hash text;
BEGIN
  SELECT row_hash INTO previous_hash FROM claims_ledger ORDER BY seq DESC LIMIT 1;
  NEW.prev_hash := previous_hash;
  NEW.row_hash := claims_ledger_row_signature(
    previous_hash, NEW.id, NEW.owner_member_id, NEW.co2e_grams, NEW.payload, NEW.created_at
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER claims_ledger_chain_before_insert
  BEFORE INSERT ON claims_ledger
  FOR EACH ROW EXECUTE FUNCTION claims_ledger_chain();

CREATE OR REPLACE FUNCTION reject_claims_ledger_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'claims_ledger is append-only and hash-chained: % is not allowed.', TG_OP;
END;
$$;

CREATE TRIGGER claims_ledger_append_only
  BEFORE UPDATE OR DELETE ON claims_ledger
  FOR EACH ROW EXECUTE FUNCTION reject_claims_ledger_mutation();

-- Walks the whole ledger and reports every row whose stored hash no longer matches what its
-- own content, plus the preceding row's CURRENT hash, would produce. A row failing on
-- `stored_prev_hash <> expected_prev_hash` means something upstream of it changed; a row
-- failing on its own recomputed hash means that row's content changed directly. This detects
-- realistic tampering (a direct UPDATE that edits data without also recomputing every
-- downstream hash) — it cannot detect an attacker who rewrites an entire chain tail
-- consistently, which no hash chain can without an external anchor. SECURITY DEFINER, so it
-- sees every member's rows regardless of the caller's own current_member_id.
CREATE OR REPLACE FUNCTION verify_claims_chain()
RETURNS TABLE(seq bigint, id uuid, valid boolean, reason text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT
      c.seq, c.id, c.owner_member_id, c.co2e_grams, c.payload, c.created_at, c.prev_hash, c.row_hash,
      lag(c.row_hash) OVER (ORDER BY c.seq) AS actual_prev_hash
    FROM claims_ledger c
  ),
  checked AS (
    SELECT
      seq,
      id,
      claims_ledger_row_signature(
        actual_prev_hash, id, owner_member_id, co2e_grams, payload, created_at
      ) AS expected_hash,
      row_hash,
      coalesce(actual_prev_hash, '') AS expected_prev_hash,
      coalesce(prev_hash, '') AS stored_prev_hash
    FROM ordered
  )
  SELECT
    seq,
    id,
    (expected_hash = row_hash AND expected_prev_hash = stored_prev_hash) AS valid,
    CASE
      WHEN expected_prev_hash <> stored_prev_hash THEN 'prev_hash does not match the preceding row''s current hash'
      WHEN expected_hash <> row_hash THEN 'row_hash does not match this row''s own content'
      ELSE NULL
    END AS reason
  FROM checked
  ORDER BY seq;
$$;

GRANT EXECUTE ON FUNCTION verify_claims_chain() TO freyo_tenant;

-- audit_events: tenant-scoped, insert-only by grant --------------------------------------
-- A lighter guarantee than the trigger-enforced tables above: no UPDATE/DELETE grant means
-- freyo_tenant cannot mutate rows, but (unlike emission_records/claims_ledger) there is no
-- trigger stopping the table owner. That's an intentional, documented gap — see
-- src/schema/auditEvents.ts — nothing here needs tamper-evidence today.
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_events_tenant_isolation ON audit_events
  USING (member_id = current_member_id())
  WITH CHECK (member_id = current_member_id());
GRANT SELECT, INSERT ON audit_events TO freyo_tenant;

-- cost.movement_costs: strictest isolation in the schema — see src/schema/cost.ts ---------
ALTER TABLE cost.movement_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY movement_costs_tenant_isolation ON cost.movement_costs
  USING (member_id = current_member_id())
  WITH CHECK (member_id = current_member_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON cost.movement_costs TO freyo_tenant;

-- Every table above already exists (this migration runs after 0000_*.sql), so a blanket
-- grant here is safe and saves hand-naming each bigserial/identity sequence.
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO freyo_tenant;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA cost TO freyo_tenant;
