/**
 * Review fix 2026-11-04 (FIX-DB), DB tests on TEST_DATABASE_URL only:
 *  - S-27 / D-11: a phone removed by a business edit is kept as history and still blocks duplicates.
 *  - D-06: the similar-name check uses `businesses_similar_names` (trigram `%` + exact `>=`), no GUC leak.
 *  - C-20: archiving is refused while the business has an open deal or a live contact reservation.
 *  - D20: original attendance facts are immutable.
 * Every case runs inside a transaction that is rolled back (nothing is left behind).
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import type { Principal } from '../../shared/access.js';
import accessModule from '../access/module.js';
import businessesModule from './module.js';
import * as repo from './repo.js';
import { setBusinessArchived } from './service.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

async function inRollback(fn: (tx: PoolClient) => Promise<void>): Promise<void> {
  const tx = await pool.connect();
  try {
    await tx.query('BEGIN');
    await fn(tx);
  } finally {
    await tx.query('ROLLBACK').catch(() => undefined);
    tx.release();
  }
}

async function errorOf(tx: PoolClient, fn: () => Promise<unknown>): Promise<{ code?: string; constraint?: string } | null> {
  await tx.query('SAVEPOINT t');
  try {
    await fn();
    await tx.query('RELEASE SAVEPOINT t');
    return null;
  } catch (e) {
    await tx.query('ROLLBACK TO SAVEPOINT t');
    return e as { code?: string; constraint?: string };
  }
}

const ownerId = async (tx: PoolClient) =>
  (await tx.query<{ id: string }>(`SELECT id FROM employees WHERE role = 'owner' AND is_active ORDER BY created_at LIMIT 1`)).rows[0].id;

async function makeBusiness(tx: PoolClient, name: string, by: string): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO businesses (name, normalized_name, normalized_branch, name_key, created_by)
     VALUES ($1::text, lower($1::text), '', lower($1::text) || '|', $2) RETURNING id`,
    [name, by]
  );
  return rows[0].id;
}

const num = () => `+9617${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
const phoneOf = (normalized: string) => ({ countryCode: '+961', number: normalized.slice(4), normalized });

describe.skipIf(!hasTestDb)('FIX-DB integrity (review 2026-11-04)', () => {
  it('S-27: a removed phone stays in the registry and still blocks other businesses; the same business may take it back', async () => {
    await inRollback(async (tx) => {
      const me = await ownerId(tx);
      const a = await makeBusiness(tx, `fixdb phone a ${randomUUID()}`, me);
      const b = await makeBusiness(tx, `fixdb phone b ${randomUUID()}`, me);
      const x = num();
      const y = num();
      await repo.replacePhones(tx, a, [phoneOf(x), phoneOf(y)]);
      await repo.replacePhones(tx, a, [phoneOf(y)]); // edit removes x

      const current = await tx.query('SELECT 1 FROM business_phones WHERE normalized_phone = $1', [x]);
      expect(current.rowCount).toBe(0);
      const reg = await tx.query<{ business_id: string; removed: boolean }>(
        'SELECT business_id, removed_at IS NOT NULL AS removed FROM business_phone_registry WHERE normalized_phone = $1',
        [x]
      );
      expect(reg.rows).toEqual([{ business_id: a, removed: true }]);

      // Duplicate check (create: no exclusion) still finds it, flagged as history.
      expect(await repo.findPhoneMatch(tx, [x], null)).toEqual({ business_id: a, normalized_phone: x, removed: true });
      expect(await repo.findPhoneMatch(tx, [x], b)).toEqual({ business_id: a, normalized_phone: x, removed: true });
      // The business itself is excluded from its own check (D11 integrity).
      expect(await repo.findPhoneMatch(tx, [x], a)).toBeNull();

      // DB guarantee: another business cannot take the removed number (shaped like the unique index).
      const err = await errorOf(tx, () => repo.replacePhones(tx, b, [phoneOf(x)]));
      expect(err?.code).toBe('23505');
      expect(err?.constraint).toBe('uq_business_phones_normalized');

      // The same business may re-add it: it becomes current again.
      await repo.replacePhones(tx, a, [phoneOf(y), phoneOf(x)]);
      const back = await tx.query<{ removed: boolean }>(
        'SELECT removed_at IS NOT NULL AS removed FROM business_phone_registry WHERE normalized_phone = $1',
        [x]
      );
      expect(back.rows).toEqual([{ removed: false }]);
    });
  });

  it('D-06: similar names keep the >= 0.6 rule and the threshold never leaks into the session', async () => {
    await inRollback(async (tx) => {
      const me = await ownerId(tx);
      const tag = randomUUID().slice(0, 8);
      const id = await makeBusiness(tx, `fixdb bakery ${tag}`, me);
      const hits = await repo.findSimilarNames(tx, `fixdb bakery ${tag}x`, 0.6, null);
      expect(hits.find((h) => h.id === id)?.similarity).toBeGreaterThanOrEqual(0.6);
      // Exact same normalised name is not a "similar" row; the record itself can be excluded.
      expect((await repo.findSimilarNames(tx, `fixdb bakery ${tag}`, 0.6, null)).some((h) => h.id === id)).toBe(false);
      expect((await repo.findSimilarNames(tx, `fixdb bakery ${tag}x`, 0.6, id)).some((h) => h.id === id)).toBe(false);
      expect((await repo.findSimilarNames(tx, `fixdb bakery ${tag}x`, 0.99, null)).some((h) => h.id === id)).toBe(false);
      const guc = await tx.query<{ t: string }>(`SELECT current_setting('pg_trgm.similarity_threshold') AS t`);
      expect(guc.rows[0].t).toBe('0.3');
    });
  });

  it('C-20: archive is refused with 409 while a deal is open or a reservation is live', async () => {
    accessModule.init?.();
    businessesModule.init?.();
    await inRollback(async (tx) => {
      const me = await ownerId(tx);
      const principal: Principal = { employeeId: me, role: 'owner', sessionState: 'active' };
      const ctx = {
        tx,
        actor: { kind: 'employee' as const, employeeId: me, role: 'owner' as const, sessionId: randomUUID(), sessionState: 'active' as const },
        requestId: null,
        clientIp: null,
        now: new Date(),
      };
      const id = await makeBusiness(tx, `fixdb archive ${randomUUID()}`, me);

      const res = await tx.query<{ id: string }>(
        `INSERT INTO contact_reservations (business_id, holder_id, lease_expires_at) VALUES ($1, $2, now() + interval '10 minutes') RETURNING id`,
        [id, me]
      );
      const r1 = await errorOf(tx, () => setBusinessArchived(ctx as never, principal, id, 1, true, null));
      expect(r1).toMatchObject({ statusCode: 409, code: 'STATE_CONFLICT', details: { reason: 'ACTIVE_RESERVATION' } });

      await tx.query(`UPDATE contact_reservations SET state = 'released', ended_at = now(), end_reason = 'released' WHERE id = $1`, [res.rows[0].id]);
      const att = await tx.query<{ id: string }>(
        `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1, $2, 'accepted', $3) RETURNING id`,
        [id, me, randomUUID()]
      );
      await tx.query(`INSERT INTO deals (business_id, accepted_attempt_id, accepted_by_id, client_needs_note) VALUES ($1, $2, $3, 'fixdb')`, [
        id,
        att.rows[0].id,
        me,
      ]);
      const r2 = await errorOf(tx, () => setBusinessArchived(ctx as never, principal, id, 1, true, null));
      expect(r2).toMatchObject({ statusCode: 409, code: 'STATE_CONFLICT', details: { reason: 'OPEN_DEAL' } });

      await errorOf(tx, () => tx.query(`UPDATE deals SET stage = 'not_proceeding' WHERE business_id = $1`, [id]));
      const stage = await tx.query<{ stage: string }>('SELECT stage FROM deals WHERE business_id = $1', [id]);
      if (stage.rows[0].stage === 'not_proceeding') {
        const ok = await setBusinessArchived(ctx as never, principal, id, 1, true, 'closed down');
        expect(ok.archived).toBe(true);
      }
    });
  });

  it('D20: original attendance facts are immutable; effective times may change; sessions are never deleted', async () => {
    await inRollback(async (tx) => {
      const me = await ownerId(tx);
      const s = await tx.query<{ id: string }>(
        `INSERT INTO attendance_sessions (employee_id, state, work_date, check_in_at, effective_check_in_at)
         VALUES ($1, 'open', DATE '2020-01-02', TIMESTAMPTZ '2020-01-02 08:00Z', TIMESTAMPTZ '2020-01-02 08:00Z') RETURNING id`,
        [me]
      );
      const id = s.rows[0].id;
      expect((await errorOf(tx, () => tx.query(`UPDATE attendance_sessions SET check_in_at = check_in_at - interval '1 hour' WHERE id = $1`, [id])))?.code).toBe('23000');
      expect(await errorOf(tx, () => tx.query(`UPDATE attendance_sessions SET effective_check_in_at = effective_check_in_at - interval '1 hour' WHERE id = $1`, [id]))).toBeNull();
      // Check-out is written once.
      expect(await errorOf(tx, () => tx.query(`UPDATE attendance_sessions SET state = 'closed', check_out_at = TIMESTAMPTZ '2020-01-02 17:00Z', effective_check_out_at = TIMESTAMPTZ '2020-01-02 17:00Z' WHERE id = $1`, [id]))).toBeNull();
      expect((await errorOf(tx, () => tx.query(`UPDATE attendance_sessions SET check_out_at = TIMESTAMPTZ '2020-01-02 18:00Z' WHERE id = $1`, [id])))?.code).toBe('23000');
      expect((await errorOf(tx, () => tx.query('DELETE FROM attendance_sessions WHERE id = $1', [id])))?.code).toMatch(/^(23000|42501)$/); // trigger (owner) or no DELETE grant (app role)
    });
  });
});
