/**
 * D13 (policy baseline 2026-10-29): each social metric stores when it was observed. The timestamp is set
 * only when that value is entered or changed, kept while unchanged, and NULL while the value is Unknown.
 * Unknown is not zero. DB test (TEST_DATABASE_URL only).
 */
import { describe, expect, it } from 'vitest';
import { query, withTransaction } from '../../db/pool.js';
import { replaceSocials, type SocialValues } from './repo.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDb)('D13 social metric observed-at', () => {
  async function business(): Promise<string> {
    const { rows: emp } = await query<{ id: string }>(`SELECT id FROM employees WHERE role = 'owner' ORDER BY created_at LIMIT 1`);
    const { rows } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [
      `D13 Biz ${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
      emp[0].id,
    ]);
    return rows[0].id;
  }

  const row = async (id: string) =>
    (
      await query<{ followers: number | null; followers_observed_at: Date | null; last_post_observed_at: Date | null }>(
        'SELECT followers, followers_observed_at, last_post_observed_at FROM social_accounts WHERE business_id = $1',
        [id]
      )
    ).rows[0];

  const save = (id: string, s: Partial<SocialValues>, at: Date) =>
    withTransaction((tx) =>
      replaceSocials(tx, id, [{ platform: 'instagram', handle: '@d13', normalizedHandle: 'd13', followers: null, lastPost: null, ...s }], at)
    );

  it('sets each metric timestamp only when that value is entered or changed', async () => {
    const id = await business();
    const t1 = new Date('2026-10-01T10:00:00Z');
    const t2 = new Date('2026-10-02T10:00:00Z');
    const t3 = new Date('2026-10-03T10:00:00Z');

    await save(id, { followers: null, lastPost: null }, t1);
    expect(await row(id)).toMatchObject({ followers: null, followers_observed_at: null, last_post_observed_at: null });

    // Followers entered (0 is a value, not Unknown); last post still Unknown.
    await save(id, { followers: 0, lastPost: null }, t2);
    let r = await row(id);
    expect(r.followers).toBe(0);
    expect(r.followers_observed_at?.toISOString()).toBe(t2.toISOString());
    expect(r.last_post_observed_at).toBeNull();

    // Last post entered later: followers keep their own observation time.
    await save(id, { followers: 0, lastPost: '2026-09-30' }, t3);
    r = await row(id);
    expect(r.followers_observed_at?.toISOString()).toBe(t2.toISOString());
    expect(r.last_post_observed_at?.toISOString()).toBe(t3.toISOString());

    // Followers changed: only that timestamp moves. Back to Unknown clears it.
    const t4 = new Date('2026-10-04T10:00:00Z');
    await save(id, { followers: 120, lastPost: '2026-09-30' }, t4);
    r = await row(id);
    expect(r.followers_observed_at?.toISOString()).toBe(t4.toISOString());
    expect(r.last_post_observed_at?.toISOString()).toBe(t3.toISOString());
    await save(id, { followers: null, lastPost: '2026-09-30' }, new Date('2026-10-05T10:00:00Z'));
    r = await row(id);
    expect(r.followers_observed_at).toBeNull();
    expect(r.last_post_observed_at?.toISOString()).toBe(t3.toISOString());
  });
});
