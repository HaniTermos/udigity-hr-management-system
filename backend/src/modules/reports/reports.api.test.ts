/**
 * MOD-reports DB API tests (TEST_DATABASE_URL only).
 * Covers Owner dashboard metrics, reports catalogue, synchronous streaming exports (CSV/JSON),
 * and role access enforcement.
 */
import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { storeEnrolledSecret } from '../identity/twoFactor.js';
import { escapeCsvField, formatAsCsv } from './service.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';

type Role = 'owner' | 'data_entry' | 'call_center' | 'developer';
interface Agent {
  cookie: string;
  csrf: string;
  id: string;
  role: Role;
}

const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

function cookieFrom(res: request.Response): string {
  const c = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`));
  return c ? c.split(';')[0] : '';
}

async function login(email: string) {
  const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password: PASSWORD });
  return { res, cookie: cookieFrom(res), csrf: res.body.csrfToken as string };
}

function call(a: Agent, method: 'get' | 'post' | 'patch', path: string, body?: object) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf).set('Idempotency-Key', crypto.randomUUID());
  return body ? r.send(body) : r;
}

async function makeEmployee(role: Role): Promise<{ id: string; email: string }> {
  const email = `reports.${role}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, `Reports ${role}`, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  return { id: rows[0].id, email };
}

async function agentFor(role: Exclude<Role, 'owner'>): Promise<Agent> {
  const e = await makeEmployee(role);
  const s = await login(e.email);
  expect(s.res.status).toBe(200);
  return { cookie: s.cookie, csrf: s.csrf, id: e.id, role };
}

async function ownerAgent(): Promise<Agent> {
  const e = await makeEmployee('owner');
  await withTransaction((tx) => storeEnrolledSecret(tx, e.id, DEV_TOTP_SECRET));
  const s = await login(e.email);
  const v = await request(app)
    .post('/api/auth/2fa/verify')
    .set('Cookie', s.cookie)
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', s.csrf)
    .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, id: e.id, role: 'owner' };
}

describe.skipIf(!hasTestDb)('MOD-reports API (/api/dashboard & /api/reports)', () => {
  let owner: Agent;
  let dev: Agent;

  beforeAll(async () => {
    owner = await ownerAgent();
    dev = await agentFor('developer');
  });

  afterAll(async () => {
    // cleanup
  });

  it('Owner reads §5A dashboard metrics; non-owner is denied (403)', async () => {
    // Non-owner developer attempt
    const devRes = await call(dev, 'get', '/api/dashboard?period=7d');
    expect(devRes.status).toBe(403);

    // Owner reads dashboard
    const ownerRes = await call(owner, 'get', '/api/dashboard?period=7d');
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body).toHaveProperty('businesses');
    expect(ownerRes.body).toHaveProperty('commercial');
    expect(ownerRes.body).toHaveProperty('delivery');
    expect(ownerRes.body).toHaveProperty('attendance');
    expect(ownerRes.body).toHaveProperty('workload');
    expect(Array.isArray(ownerRes.body.workload.developerWorkload)).toBe(true);
  });

  it('Catalogue list and export CSV/JSON', async () => {
    // List available reports
    const listRes = await call(owner, 'get', '/api/reports');
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBeGreaterThan(0);

    // Non-owner cannot export
    const devExport = await call(dev, 'post', '/api/reports/export', {
      report: 'rep-4',
      format: 'csv',
    });
    expect(devExport.status).toBe(403);

    // R2-02: the first export of a session needs a step-up code.
    await stepUp(owner);

    // Owner exports CSV
    const csvExport = await call(owner, 'post', '/api/reports/export', {
      report: 'rep-4',
      format: 'csv',
    });
    expect(csvExport.status).toBe(200);
    expect(csvExport.headers['content-type']).toContain('text/csv');
    expect(csvExport.headers['content-disposition']).toContain('attachment');
    expect(csvExport.headers['x-export-truncated']).toMatch(/^(true|false)$/);

    // Owner exports JSON
    const jsonExport = await call(owner, 'post', '/api/reports/export', {
      report: 'rep-4',
      format: 'json',
    });
    expect(jsonExport.status).toBe(200);
    expect(jsonExport.headers['content-type']).toContain('application/json');
  });

  // ---------------------------------------------------------------------------------------------
  // Security review R2-01 / R2-02
  // ---------------------------------------------------------------------------------------------
  async function freshStep(employeeId: string) {
    await query('UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL WHERE employee_id = $1', [employeeId]);
  }

  /** Step up with a current code (the login verify used this 30 s step, so clear the replay marker). */
  async function stepUp(a: Agent) {
    await freshStep(a.id);
    const r = await call(a, 'post', '/api/reports/export', { report: 'rep-4', format: 'json', totpCode: authenticator.generate(DEV_TOTP_SECRET) });
    expect(r.status).toBe(200);
  }

  async function auditReasons(actorId: string): Promise<string[]> {
    const { rows } = await query<{ reason: string }>(
      `SELECT payload->>'reason' AS reason FROM audit_events WHERE event_name = 'report.export_denied' AND actor_id = $1 ORDER BY created_at`,
      [actorId]
    );
    return rows.map((r) => r.reason);
  }

  it('R2-02 role matrix: export (GET and POST) is Owner only; others 403 FORBIDDEN_ROLE', async () => {
    for (const role of ['data_entry', 'call_center', 'developer'] as const) {
      const a = await agentFor(role);
      for (const method of ['get', 'post'] as const) {
        const r = method === 'get' ? await call(a, 'get', '/api/reports/export?report=rep-4') : await call(a, 'post', '/api/reports/export', { report: 'rep-4' });
        expect(r.status, `${role} ${method}`).toBe(403);
        expect(r.body.code).toBe('FORBIDDEN_ROLE');
      }
      expect((await call(a, 'get', '/api/reports')).status).toBe(403);
      expect((await call(a, 'get', '/api/dashboard')).status).toBe(403);
    }
  });

  it('R2-02: GET export is 405 and changes nothing (no export record, no rows)', async () => {
    const o = await ownerAgent();
    const before = await query<{ n: number }>('SELECT count(*)::int AS n FROM export_records WHERE requested_by = $1', [o.id]);
    const r = await call(o, 'get', '/api/reports/export?report=rep-4&format=csv');
    expect(r.status).toBe(405);
    expect(r.headers.allow).toBe('POST');
    expect(r.body.code).toBe('METHOD_NOT_ALLOWED');
    const after = await query<{ n: number }>('SELECT count(*)::int AS n FROM export_records WHERE requested_by = $1', [o.id]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('R2-02 step-up: no code → 403 STEP_UP_REQUIRED; wrong code → 400; good code works for 10 min; all denials audited', async () => {
    const o = await ownerAgent();
    const none = await call(o, 'post', '/api/reports/export', { report: 'rep-4' });
    expect(none.status).toBe(403);
    expect(none.body.code).toBe('STEP_UP_REQUIRED');
    const bad = await call(o, 'post', '/api/reports/export', { report: 'rep-4', totpCode: '000000' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_2FA_TOKEN');
    expect(await auditReasons(o.id)).toEqual(['step_up_required', 'step_up_invalid']);
    const { rows: none0 } = await query<{ n: number }>('SELECT count(*)::int AS n FROM export_records WHERE requested_by = $1', [o.id]);
    expect(none0[0].n).toBe(0);

    await stepUp(o);
    const again = await call(o, 'post', '/api/reports/export', { report: 'rep-4' });
    expect(again.status).toBe(200);

    // Older than 10 minutes → required again.
    await query(`UPDATE sessions SET step_up_at = now() - interval '11 minutes' WHERE employee_id = $1 AND step_up_at IS NOT NULL`, [o.id]);
    const stale = await call(o, 'post', '/api/reports/export', { report: 'rep-4' });
    expect(stale.status).toBe(403);
    expect(stale.body.code).toBe('STEP_UP_REQUIRED');
    const exported = await query<{ n: number }>(`SELECT count(*)::int AS n FROM audit_events WHERE event_name = 'report.exported' AND actor_id = $1`, [o.id]);
    expect(exported.rows[0].n).toBe(2);
  });

  it('every catalogue report exports (CSV) without a database error', async () => {
    const o = await ownerAgent();
    await stepUp(o);
    for (const report of ['rep-1', 'rep-2', 'rep-3', 'rep-4']) {
      const r = await call(o, 'post', '/api/reports/export', { report, format: 'csv' });
      expect(r.status, `${report}: ${JSON.stringify(r.body)}`).toBe(200);
    }
  });

  it('R2-02: exports are rate-limited per Owner (429 RATE_LIMITED after 20 in 10 min)', async () => {
    const o = await ownerAgent();
    for (let i = 0; i < 20; i++) expect((await call(o, 'post', '/api/reports/export', { report: 'rep-4' })).status).toBe(403);
    const limited = await call(o, 'post', '/api/reports/export', { report: 'rep-4' });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('RATE_LIMITED');
  });
});

describe('R2-01 CSV formula injection', () => {
  it('prefixes = + - @ TAB CR cells with an apostrophe, then quotes as usual', () => {
    expect(escapeCsvField('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(escapeCsvField('+1 555')).toBe("'+1 555");
    expect(escapeCsvField('-2+3')).toBe("'-2+3");
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvField('\tcmd')).toBe("'\tcmd");
    expect(escapeCsvField('\rcmd')).toBe(`"'\rcmd"`);
    expect(escapeCsvField('Cafe = Bar')).toBe('Cafe = Bar');
    expect(escapeCsvField(42)).toBe('42');
    expect(escapeCsvField(-5)).toBe('-5'); // numbers cannot carry a formula
    expect(escapeCsvField(null)).toBe('');
    expect(formatAsCsv([{ name: '=1+1', ok: 'x' }])).toBe("name,ok\r\n'=1+1,x");
  });
});
