/**
 * Review fixes FIX-BE-A (C-01..C-06, C-10, C-11, C-16, C-17, C-18). Pure tests always run;
 * DB tests only with TEST_DATABASE_URL. (C-07 / D-04 live in modules/deals/delivery.api.test.ts.)
 */
import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../app.js';
import { query, withTransaction } from '../db/pool.js';
import { config } from '../config/index.js';
import { DEV_TOTP_SECRET } from '../db/seed.js';
import { storeEnrolledSecret } from '../modules/identity/twoFactor.js';
import { escapeCsvField, formatAsCsv } from '../modules/reports/service.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { orderByClause } from '../shared/pagination.js';
import { isRealIsoDate, safeString } from '../shared/validation.js';

describe('shared validation helpers (C-01)', () => {
  it('isRealIsoDate rejects impossible and out-of-range dates', () => {
    for (const d of ['2026-02-31', '0000-01-01', '9999-12-31', '2026-13-01', '2026-1-1', 'x']) expect(isRealIsoDate(d)).toBe(false);
    for (const d of ['2026-02-28', '2028-02-29', '1900-01-01']) expect(isRealIsoDate(d)).toBe(true);
  });
  it('safeString rejects NUL and control characters but keeps newlines', () => {
    expect(safeString().safeParse('a\u0000b').success).toBe(false);
    expect(safeString().safeParse('a\u0007b').success).toBe(false);
    expect(safeString().safeParse('line1\nline2\ttab').success).toBe(true);
  });
  it('unknown sort is a 400; valid sorts get a tie-breaker (C-11, C-02)', () => {
    expect(() => orderByClause({ sort: 'nope', order: 'asc' }, { a: 'x.a' }, 'a')).toThrow();
    expect(orderByClause({ sort: undefined, order: 'desc' }, { a: 'x.a' }, 'a', 'x.id')).toBe('ORDER BY x.a DESC, x.id DESC');
  });
});

describe('error handler pg mapping', () => {
  const run = (code: string) => {
    const headers: Record<string, string> = {};
    const out: { status?: number; body?: Record<string, unknown> } = {};
    const res = {
      setHeader: (k: string, v: string) => void (headers[k] = v),
      status(n: number) { out.status = n; return this; },
      json(b: Record<string, unknown>) { out.body = b; return this; },
    };
    const req = { requestId: 'rid', method: 'GET', originalUrl: '/x', baseUrl: '/x', route: { path: '' } };
    errorHandler(Object.assign(new Error('pg'), { code }), req as never, res as never, () => undefined);
    return { ...out, headers };
  };
  it('maps client-input data errors to 400 and lock/statement timeouts to 503 BUSY_TRY_AGAIN', () => {
    for (const c of ['22007', '22008', '22003', '22P02', '22021']) {
      const r = run(c);
      expect(r.status).toBe(400);
      expect(r.body?.code).toBe('VALIDATION_ERROR');
      expect(r.body?.requestId).toBe('rid');
    }
    for (const c of ['55P03', '57014']) {
      const r = run(c);
      expect(r.status).toBe(503);
      expect(r.body?.code).toBe('BUSY_TRY_AGAIN');
      expect(r.headers['Retry-After']).toBe('5');
    }
    expect(run('23514').status).toBe(422);
  });
});

describe('CSV dates (C-04)', () => {
  it('writes a Date as plain ISO text, still escaping formulas', () => {
    const d = new Date('2026-11-04T08:58:14.492Z');
    expect(escapeCsvField(d)).toBe('2026-11-04T08:58:14.492Z');
    expect(formatAsCsv([{ at: d, f: '=1+1' }])).toBe("at,f\r\n2026-11-04T08:58:14.492Z,'=1+1");
  });
});

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

interface Agent {
  cookie: string;
  csrf: string;
  id: string;
}
const cookieFrom = (res: request.Response) =>
  (([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`)) ?? '').split(';')[0];

function call(a: Agent, method: 'get' | 'post' | 'patch', path: string, body?: object, key: string | null = crypto.randomUUID()) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') {
    r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf);
    if (key) r.set('Idempotency-Key', key);
  }
  return body ? r.send(body) : r;
}

async function makeEmployee(role: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [`fxa.${role}.${uniq()}@test.local`, `FXA ${role}`, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  return rows[0].id;
}

async function ownerAgent(): Promise<Agent> {
  const id = await makeEmployee('owner');
  await withTransaction((tx) => storeEnrolledSecret(tx, id, DEV_TOTP_SECRET));
  const { rows } = await query<{ email: string }>('SELECT email FROM employees WHERE id = $1', [id]);
  const login = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: rows[0].email, password: PASSWORD });
  const v = await request(app)
    .post('/api/auth/2fa/verify')
    .set('Cookie', cookieFrom(login))
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', login.body.csrfToken)
    .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, id };
}

describe.skipIf(!hasTestDb)('FIX-BE-A API behaviour', { timeout: 120_000 }, () => {
  it('C-01 / C-10 / C-11: bad dates, NUL, unknown sort, bad ids are 400 with a requestId', async () => {
    const owner = await ownerAgent();
    const cases = [
      '/api/deals?from=2026-02-31',
      '/api/deals?from=0000-01-01',
      '/api/audit-events?from=2026-02-31',
      '/api/deals?q=a%00b',
      '/api/businesses?q=a%00b',
      '/api/search?q=a%00b',
      '/api/deals?sort=nope',
      '/api/targets?sort=nope',
      '/api/work-items?sort=nope',
      '/api/businesses/not-a-uuid',
    ];
    for (const p of cases) {
      const r = await call(owner, 'get', p);
      expect(r.status, p).toBe(400);
      expect(r.body.code, p).toBe('VALIDATION_ERROR');
      expect(r.body.requestId, p).toBeTruthy();
    }
    const emp = await makeEmployee('call_center');
    const bodies: Array<[string, object]> = [
      ['/api/work-items', { assigneeId: emp, title: 'x', dueDate: '2026-02-31' }],
      ['/api/work-items', { assigneeId: emp, title: 'a\u0000b' }],
      ['/api/targets', { employeeId: emp, metric: 'outreach_calls', period: 'daily', targetValue: 9.9e15, startDate: '2100-01-01' }],
      ['/api/targets', { employeeId: emp, metric: 'outreach_calls', period: 'daily', targetValue: 0.5, startDate: '2100-01-01' }],
    ];
    for (const [p, b] of bodies) {
      const r = await call(owner, 'post', p, b);
      expect(r.status, JSON.stringify(b)).toBe(400);
    }
    const bad = await request(app).post('/api/auth/login').set('Origin', ORIGIN).set('Content-Type', 'application/json').send('{bad');
    expect(bad.status).toBe(400);
    expect(bad.body.requestId).toBeTruthy();
  });

  it('C-02 / C-17: lists page without gaps; overlapping duplicate targets are refused', async () => {
    const owner = await ownerAgent();
    const emp = await makeEmployee('call_center');
    await query(
      `INSERT INTO targets (employee_id, metric, period, target_value, start_date, end_date, created_at)
       SELECT $1, 'outreach_calls', 'daily', 5, DATE '2100-01-01' + g, DATE '2100-01-01' + g, '2026-01-01T00:00:00Z' FROM generate_series(1, 40) g`,
      [emp]
    );
    await query(
      `INSERT INTO work_items (assignee_id, title, status, created_at)
       SELECT $1, 'w' || g, 'open', '2026-01-01T00:00:00Z' FROM generate_series(1, 40) g`,
      [emp]
    );
    for (const path of [`/api/targets?employeeId=${emp}`, '/api/work-items?x=1']) {
      const seen = new Set<string>();
      let total = 0;
      for (let page = 1; page <= 200; page++) {
        const r = await call(owner, 'get', `${path}&pageSize=7&page=${page}`.replace('?x=1&', '?'));
        expect(r.status).toBe(200);
        total = r.body.total;
        for (const it of r.body.items) seen.add(it.id);
        if (r.body.items.length === 0) break;
      }
      expect(seen.size).toBe(total);
    }
    const dup = { employeeId: emp, metric: 'outreach_calls', period: 'daily', targetValue: 5, startDate: '2100-01-02' };
    const dr = await call(owner, 'post', '/api/targets', dup);
    expect(dr.status, JSON.stringify(dr.body)).toBe(409);
    expect((await call(owner, 'post', '/api/targets', { ...dup, startDate: '2100-03-01' })).status).toBe(201);
  });

  it('C-06: total stays real past the last page (Owner: deals, projects; scoped Developer: their own deals)', async () => {
    const owner = await ownerAgent();
    for (const p of ['/api/deals', '/api/projects']) {
      const first = await call(owner, 'get', `${p}?pageSize=3&page=1`);
      const far = await call(owner, 'get', `${p}?pageSize=3&page=500`);
      expect(first.status).toBe(200);
      expect(far.body.items).toEqual([]);
      expect(far.body.total).toBe(first.body.total);
    }
    // Review H §6.2 #4: the scoped role (R-02 broke it) with rows of its own, so the totals are not 0 = 0.
    const devId = await makeEmployee('developer');
    const { rows: e } = await query<{ email: string }>('SELECT email FROM employees WHERE id = $1', [devId]);
    const login = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: e[0].email, password: PASSWORD });
    const dev: Agent = { cookie: cookieFrom(login), csrf: login.body.csrfToken, id: devId };
    const tag = uniq();
    for (let i = 0; i < 5; i++) {
      const { rows: b } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [`FXA dev deal ${i}.${tag}`, owner.id]);
      const { rows: a } = await query<{ id: string }>(
        `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1, $2, 'accepted', $3) RETURNING id`,
        [b[0].id, owner.id, crypto.randomUUID()]
      );
      await query(
        `INSERT INTO deals (business_id, accepted_attempt_id, accepted_by_id, client_needs_note, assigned_developer_id) VALUES ($1, $2, $3, 'fxa', $4)`,
        [b[0].id, a[0].id, owner.id, devId]
      );
    }
    const first = await call(dev, 'get', '/api/deals?scope=assigned_to_me&pageSize=3&page=1');
    expect(first.status, JSON.stringify(first.body).slice(0, 200)).toBe(200);
    expect(first.body.total).toBe(5);
    expect(first.body.items).toHaveLength(3);
    const second = await call(dev, 'get', '/api/deals?scope=assigned_to_me&pageSize=3&page=2');
    expect(second.body.items).toHaveLength(2);
    expect(new Set([...first.body.items, ...second.body.items].map((d: { id: string }) => d.id)).size).toBe(5);
    const far = await call(dev, 'get', '/api/deals?scope=assigned_to_me&pageSize=3&page=500');
    expect(far.status).toBe(200);
    expect(far.body.items).toEqual([]);
    expect(far.body.total).toBe(5);
  });

  it('C-16: a corrected body can reuse the key after a 400; a stale claim is taken over', async () => {
    const owner = await ownerAgent();
    const emp = await makeEmployee('call_center');
    const key = crypto.randomUUID();
    expect((await call(owner, 'post', '/api/work-items', { assigneeId: emp, title: '' }, key)).status).toBe(400);
    const good = await call(owner, 'post', '/api/work-items', { assigneeId: emp, title: 'fixed' }, key);
    expect(good.status).toBe(201);
    const replay = await call(owner, 'post', '/api/work-items', { assigneeId: emp, title: 'fixed' }, key);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.id).toBe(good.body.id);
    const key2 = crypto.randomUUID();
    expect((await call(owner, 'post', '/api/work-items', { assigneeId: emp, title: 'stale' }, key2)).status).toBe(201);
    await query(`UPDATE idempotency_records SET status = 0, body = NULL, created_at = now() - interval '10 minutes' WHERE idem_key = $1`, [key2]);
    expect((await call(owner, 'post', '/api/work-items', { assigneeId: emp, title: 'stale' }, key2)).status).toBe(201);
  });

  it('C-18: a date-only audit filter is accepted as a company-timezone day', async () => {
    const owner = await ownerAgent();
    const r = await call(owner, 'get', '/api/audit-events?from=2020-01-01&to=2020-01-01');
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(0);
  });

  it('C-03: parallel auto-fills for every agent (two new agents, the original repro) never push a queue past the cap', async () => {
    const owner = await ownerAgent();
    const a1 = await makeEmployee('call_center');
    const a2 = await makeEmployee('call_center');
    const tag = uniq();
    await query(
      `WITH b AS (INSERT INTO businesses (name, created_by, created_at)
                  SELECT 'FXA cap ' || g || '.${tag}', $1, now() - interval '3 years' - g * interval '1 second' FROM generate_series(1, 110) g RETURNING id)
       INSERT INTO business_phones (business_id, country_code, number, normalized_phone)
       SELECT id, '+961', '3', '+9619' || substr(md5(id::text), 1, 9) FROM b`,
      [owner.id]
    );
    const results = await Promise.all([1, 2, 3].map(() => call(owner, 'post', '/api/calling-assignments/autofill', {})));
    // H-03: an overlapping run is refused at once with 409 AUTOFILL_RUNNING (nothing changed); one run succeeds.
    for (const r of results) expect([200, 409], JSON.stringify(r.body).slice(0, 200)).toContain(r.status);
    for (const r of results.filter((x) => x.status === 409)) expect(r.body.code).toBe('AUTOFILL_RUNNING');
    expect(results.some((r) => r.status === 200)).toBe(true);
    // A follow-up run (sequential) tops every queue up to the cap and never past it.
    expect((await call(owner, 'post', '/api/calling-assignments/autofill', {})).status).toBe(200);
    const { rows } = await query<{ assignee_id: string; n: number }>(
      `SELECT assignee_id, count(*)::int n FROM calling_assignments WHERE assignee_id = ANY($1::uuid[]) AND ended_at IS NULL GROUP BY assignee_id`,
      [[a1, a2]]
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.n, r.assignee_id).toBeLessThanOrEqual(40);
      expect(r.n, r.assignee_id).toBeGreaterThan(0);
    }
    const dup = await query(`SELECT business_id FROM calling_assignments WHERE ended_at IS NULL GROUP BY business_id HAVING count(*) > 1`);
    expect(dup.rowCount).toBe(0);
  });

  it('C-04 / C-05: CSV dates have no quotes; catalogue states the row cap', async () => {
    const owner = await ownerAgent();
    await query('UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL WHERE employee_id = $1', [owner.id]);
    const cat = await call(owner, 'get', '/api/reports');
    expect(cat.body.rowCap).toBe(10_000); // S-32 (Owner 2026-11-04)
    expect(JSON.stringify(cat.body.items)).not.toMatch(/PDF|reservation locks|agent notes/);
    const r = await call(owner, 'post', '/api/reports/export', { report: 'rep-4', format: 'csv', totpCode: authenticator.generate(DEV_TOTP_SECRET) });
    expect(r.status, r.text.slice(0, 300)).toBe(200);
    expect(r.headers['x-export-row-cap']).toBe('10000');
    expect(r.text).not.toContain('"""');
    expect(r.text).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
