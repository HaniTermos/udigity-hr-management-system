/**
 * Review 2026-11-04 E-07: GET /api/meetings/attendee-options no longer exposes the staff directory to
 * Call Center / Developer (matrix §3.2 "Directory is Owner only"). Runs only against TEST_DATABASE_URL.
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const SEED_OWNER = 'udigity@gmail.com';

const cookieFrom = (res: request.Response) =>
  (([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`)) ?? '').split(';')[0];

async function staff(role: string): Promise<{ id: string; cookie: string }> {
  const email = `e07.${role}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, `E07 ${role}`, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { id: rows[0].id, cookie: cookieFrom(res) };
}

describe.skipIf(!hasTestDb)('E-07 attendee options are not a staff directory', { timeout: 60_000 }, () => {
  afterAll(async () => {
    await pool.end();
  });

  it('Call Center / Developer without a deal: only the Owners and themselves; the Owner sees everyone', async () => {
    const de = await staff('data_entry');
    const otherCc = await staff('call_center');
    const cc = await staff('call_center');
    const dv = await staff('developer');

    for (const who of [cc, dv]) {
      const r = await request(app).get('/api/meetings/attendee-options?pageSize=100').set('Cookie', who.cookie);
      expect(r.status).toBe(200);
      const ids = r.body.items.map((i: { id: string }) => i.id);
      expect(ids).toContain(who.id);
      expect(ids).not.toContain(de.id);
      expect(ids).not.toContain(otherCc.id);
      for (const item of r.body.items) {
        expect(Object.keys(item).sort()).toEqual(['fullName', 'id', 'role']);
        expect(item.id === who.id || item.role === 'owner').toBe(true);
      }
    }

    // An unknown deal is 404, not an empty directory.
    const unknown = await request(app)
      .get('/api/meetings/attendee-options?dealId=00000000-0000-4000-8000-000000000000')
      .set('Cookie', cc.cookie);
    expect(unknown.status).toBe(404);

    await query(
      `UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL, failed_window_started_at = NULL
       WHERE employee_id = (SELECT id FROM employees WHERE LOWER(email) = LOWER($1))`,
      [SEED_OWNER]
    );
    const step1 = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: SEED_OWNER, password: PASSWORD });
    const step2 = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieFrom(step1))
      .set('X-CSRF-Token', step1.body.csrfToken)
      .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
    expect(step2.status).toBe(200);
    const owner = await request(app).get(`/api/meetings/attendee-options?q=${encodeURIComponent('E07 data_entry')}&pageSize=100`).set('Cookie', cookieFrom(step2));
    expect(owner.status).toBe(200);
    expect(owner.body.items.map((i: { id: string }) => i.id)).toContain(de.id);
  });
});
