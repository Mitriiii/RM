import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from './client.js';
import { claimsLedger } from './schema/index.js';
import { createMember } from './test-support/fixtures.js';
import { createAdminDb, createTenantDb, type TestConnection } from './test-support/testDb.js';

interface VerifyRow extends Record<string, unknown> {
  seq: number;
  id: string;
  valid: boolean;
  reason: string | null;
}

async function verifyChain(admin: TestConnection): Promise<VerifyRow[]> {
  const result = await admin.db.execute<VerifyRow>(sql`SELECT * FROM verify_claims_chain()`);
  return [...result];
}

async function insertClaim(
  tenant: TestConnection,
  memberId: string,
  co2eGrams: string,
  payload: Record<string, unknown>,
) {
  const [claim] = await withTenant(tenant.db, memberId, (tx) =>
    tx.insert(claimsLedger).values({ ownerMemberId: memberId, co2eGrams, payload }).returning(),
  );
  if (!claim) throw new Error('claim insert returned no row');
  return claim;
}

let admin: TestConnection;
let tenant: TestConnection;
let memberA: Awaited<ReturnType<typeof createMember>>;
let memberB: Awaited<ReturnType<typeof createMember>>;

beforeAll(async () => {
  admin = createAdminDb();
  tenant = createTenantDb();
  memberA = await createMember(admin.db, 'shipper');
  memberB = await createMember(admin.db, 'carrier');
});

afterAll(async () => {
  await admin.close();
  await tenant.close();
});

describe('claims_ledger hash chain', () => {
  it('chains prev_hash to the actual preceding row, across members, and every row verifies clean', async () => {
    const claim1 = await insertClaim(tenant, memberA.id, '1000', { lane: 'Madrid-Zaragoza' });
    const claim2 = await insertClaim(tenant, memberB.id, '2000', { lane: 'Zaragoza-Barcelona' });
    const claim3 = await insertClaim(tenant, memberA.id, '3000', { lane: 'Madrid-Valencia' });

    const rows = await admin.db
      .select()
      .from(claimsLedger)
      .where(sql`${claimsLedger.id} IN (${claim1.id}, ${claim2.id}, ${claim3.id})`)
      .orderBy(claimsLedger.seq);

    expect(rows).toHaveLength(3);
    expect(rows[0]?.prevHash === null || typeof rows[0]?.prevHash === 'string').toBe(true);
    expect(rows[1]?.prevHash).toBe(rows[0]?.rowHash);
    expect(rows[2]?.prevHash).toBe(rows[1]?.rowHash);
    // Every row's hash is unique — no accidental collision from a broken chain formula.
    expect(new Set(rows.map((r) => r.rowHash)).size).toBe(3);

    const verification = await verifyChain(admin);
    const byId = new Map(verification.map((v) => [v.id, v]));
    for (const claim of [claim1, claim2, claim3]) {
      expect(byId.get(claim.id)?.valid).toBe(true);
    }
  });

  it("a tenant sees only their own claims, never another member's", async () => {
    const claim = await insertClaim(tenant, memberA.id, '500', { lane: 'test' });

    const asOwner = await withTenant(tenant.db, memberA.id, (tx) =>
      tx.select().from(claimsLedger).where(eq(claimsLedger.id, claim.id)),
    );
    expect(asOwner).toHaveLength(1);

    const asOther = await withTenant(tenant.db, memberB.id, (tx) =>
      tx.select().from(claimsLedger).where(eq(claimsLedger.id, claim.id)),
    );
    expect(asOther).toEqual([]);
  });

  it('the app role cannot compute its own row_hash — the column is server-computed regardless of what is supplied', async () => {
    const claim = await withTenant(tenant.db, memberA.id, async (tx) => {
      const [row] = await tx
        .insert(claimsLedger)
        .values({
          ownerMemberId: memberA.id,
          co2eGrams: '10',
          payload: { forged: true },
          // rowHash has a nullable-looking default only so the app isn't required to
          // compute one — the trigger overwrites it unconditionally regardless of what's
          // supplied here, which is exactly what this test confirms at runtime.
          rowHash: 'forged-hash-not-computed-by-trigger',
        })
        .returning();
      return row;
    });
    expect(claim?.rowHash).not.toBe('forged-hash-not-computed-by-trigger');
    expect(claim?.rowHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('claims_ledger is append-only', () => {
  it('rejects UPDATE and DELETE under normal operation, even from the table-owning admin role', async () => {
    const claim = await insertClaim(tenant, memberA.id, '750', { lane: 'append-only check' });

    await expect(
      admin.db.update(claimsLedger).set({ co2eGrams: '1' }).where(eq(claimsLedger.id, claim.id)),
    ).rejects.toThrow(/append-only/i);

    await expect(
      admin.db.delete(claimsLedger).where(eq(claimsLedger.id, claim.id)),
    ).rejects.toThrow(/append-only/i);
  });
});

describe('verify_claims_chain detects tampering', () => {
  async function disableAppendOnlyTrigger<T>(fn: () => Promise<T>): Promise<T> {
    await admin.db.execute(
      sql`ALTER TABLE claims_ledger DISABLE TRIGGER claims_ledger_append_only`,
    );
    try {
      return await fn();
    } finally {
      await admin.db.execute(
        sql`ALTER TABLE claims_ledger ENABLE TRIGGER claims_ledger_append_only`,
      );
    }
  }

  it('flags a row whose content was altered directly without recomputing its hash', async () => {
    const claim1 = await insertClaim(tenant, memberA.id, '100', { lane: 'tamper-1' });
    const claim2 = await insertClaim(tenant, memberB.id, '200', { lane: 'tamper-2' });
    const claim3 = await insertClaim(tenant, memberA.id, '300', { lane: 'tamper-3' });

    const cleanVerification = await verifyChain(admin);
    const cleanById = new Map(cleanVerification.map((v) => [v.id, v]));
    expect(cleanById.get(claim1.id)?.valid).toBe(true);
    expect(cleanById.get(claim2.id)?.valid).toBe(true);
    expect(cleanById.get(claim3.id)?.valid).toBe(true);

    // Simulate an attacker (or a bug) with enough DB access to disable the guard trigger and
    // edit a row directly, leaving its stored hash stale — the realistic, sloppy case: a
    // direct UPDATE that doesn't know to also recompute row_hash.
    await disableAppendOnlyTrigger(() =>
      admin.db
        .update(claimsLedger)
        .set({ co2eGrams: '999999' })
        .where(eq(claimsLedger.id, claim2.id)),
    );

    const tamperedVerification = await verifyChain(admin);
    const tamperedById = new Map(tamperedVerification.map((v) => [v.id, v]));

    // Only the tampered row itself is flagged: its stored row_hash no longer matches its
    // (changed) content. claim2's row_hash column is untouched, so claim3's prev_hash — set
    // at insert time to claim2's original hash — still matches it. A stale-hash tamper does
    // not propagate; that's expected, not a gap (see the next test for the tamper that does).
    expect(tamperedById.get(claim1.id)?.valid).toBe(true);
    expect(tamperedById.get(claim2.id)?.valid).toBe(false);
    expect(tamperedById.get(claim2.id)?.reason).toMatch(/content/i);
    expect(tamperedById.get(claim3.id)?.valid).toBe(true);
  });

  it('flags the next row when a tamper also recomputes its own hash to look self-consistent', async () => {
    const claim1 = await insertClaim(tenant, memberA.id, '400', { lane: 'tamper-4' });
    const claim2 = await insertClaim(tenant, memberB.id, '500', { lane: 'tamper-5' });
    const claim3 = await insertClaim(tenant, memberA.id, '600', { lane: 'tamper-6' });

    const forgedCo2eGrams = '424242';
    // Computed entirely in SQL, reading prev_hash/payload/created_at natively from the row
    // rather than round-tripping them through JS — JSON.stringify's formatting doesn't match
    // Postgres's own canonical jsonb::text output (e.g. no space after ':'), so reconstructing
    // payload in JS would silently produce a hash that never matches, tampered or not.
    // Cast to the column's own numeric(14,2), not a bare numeric — co2e_grams is stored
    // with that precision/scale, so the text Postgres renders for it (e.g. "424242.00")
    // depends on it; a mismatched cast here would compute a hash for a differently-formatted
    // value than what verify_claims_chain later reads back from the column.
    const forgedHashRows = await admin.db.execute<{ forged_hash: string }>(sql`
      SELECT claims_ledger_row_signature(
        prev_hash, id, owner_member_id, ${forgedCo2eGrams}::numeric(14, 2), payload, created_at
      ) AS forged_hash
      FROM claims_ledger
      WHERE id = ${claim2.id}
    `);
    const forgedHash = [...forgedHashRows][0]?.forged_hash;
    if (!forgedHash) throw new Error('failed to compute forged hash for test setup');

    // A more sophisticated tamper: the attacker also recomputes row_hash to match the
    // forged content and the (unchanged) prev_hash, so claim2 alone looks internally
    // consistent. What it cannot fix is claim3's already-stored prev_hash, which still
    // points at claim2's *original* hash.
    await disableAppendOnlyTrigger(() =>
      admin.db
        .update(claimsLedger)
        .set({ co2eGrams: forgedCo2eGrams, rowHash: forgedHash })
        .where(eq(claimsLedger.id, claim2.id)),
    );

    const verification = await verifyChain(admin);
    const byId = new Map(verification.map((v) => [v.id, v]));

    expect(byId.get(claim1.id)?.valid).toBe(true);
    expect(byId.get(claim2.id)?.valid).toBe(true);
    expect(byId.get(claim3.id)?.valid).toBe(false);
    expect(byId.get(claim3.id)?.reason).toMatch(/preceding row/i);
  });
});
