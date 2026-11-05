/**
 * Review 2026-11-04, agent H (independent QA): re-verification of the important fixes through the real
 * Express app on TEST_DATABASE_URL. Written independently of the fix agents' own tests: each case drives
 * the HTTP surface and checks persisted state / authorization consequences, not only status codes.
 *
 * F-01 / E-01 (Owner lockout, office NAT), F-05 (reset cap across addresses), E-02 / E-08 (custom roles),
 * C-01 (bad input is 400, never 500, and raises no ops alert), S-27 (removed phone through the API),
 * C-02 / C-06 / R-02 (scoped paging), C-03 (parallel auto-fill, two agents), C-08 / D-03 (poison e-mail
 * delivery, two dispatchers), B-02 (remote-exception contract used by the new Owner screen).
 */
import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { storeEnrolledSecret } from '../../modules/identity/twoFactor.js';
import { runSystemCommand } from '../../shared/tx.js';
import { createAcceptedOpportunity } from '../../modules/deals/service.js';
import { relayOutboxOnce } from '../../modules/platform/service.js';
import { dispatchDueDeliveries } from '../../modules/notifications/service.js';
import { mailSink, setEmailTransport } from '../../modules/notifications/transport.js';
import { clock } from '../../modules/platform/clock.js';
import { setAttendanceFlagOverridesForTests } from '../../modules/attendance/service.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
const rnd7 = () => String(Math.floor(1_000_000 + Math.random() * 8_999_999));
const phone = () => ({ countryCode: '+961', number: `7${rnd7()}` });

interface Agent {
  cookie: string;
  csrf: string;
  id: string;
  email: string;
}

const cookieFrom = (res: request.Response): string =>
  (([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`)) ?? '').split(';')[0];

function call(a: Agent, method: 'get' | 'post' | 'patch' | 'put', path: string, body?: object, headers: Record<string, string> = {}) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf).set('Idempotency-Key', crypto.randomUUID());
  for (const [k, v] of Object.entries(headers)) r.set(k, v);
  return body ? r.send(body) : r;
}

async function makeEmployee(role: string, password = PASSWORD): Promise<{ id: string; email: string }> {
  const email = `h.${role.replace(/\W/g, '')}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, `H ${role}`, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(password, 4)]);
  return { id: rows[0].id, email };
}

async function agentFor(role: string): Promise<Agent> {
  const e = await makeEmployee(role);
  const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: e.email, password: PASSWORD });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { cookie: cookieFrom(res), csrf: res.body.csrfToken, ...e };
}

async function ownerAgent(): Promise<Agent> {
  const e = await makeEmployee('owner');
  await withTransaction((tx) => storeEnrolledSecret(tx, e.id, DEV_TOTP_SECRET));
  const s = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: e.email, password: PASSWORD });
  const v = await request(app)
    .post('/api/auth/2fa/verify')
    .set('Cookie', cookieFrom(s))
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', s.body.csrfToken)
    .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, ...e };
}

/** Production-like proxy trust: only the loopback hop (the in-process supertest client) is trusted. */
async function behindLoopbackProxy<T>(fn: () => Promise<T>): Promise<T> {
  const before = app.get('trust proxy');
  app.set('trust proxy', 'loopback');
  try {
    return await fn();
  } finally {
    app.set('trust proxy', before);
  }
}
const loginFrom = (ip: string, email: string, password: string) =>
  request(app).post('/api/auth/login').set('Origin', ORIGIN).set('X-Forwarded-For', ip).send({ email, password });

async function relayAll(): Promise<void> {
  for (let i = 0; i < 500; i++) if ((await relayOutboxOnce()).claimed === 0) break;
}

async function apiErrorAlerts(): Promise<number> {
  const { rows } = await query<{ n: number }>(`SELECT COALESCE(SUM(occurrences), 0)::int AS n FROM ops_alerts WHERE kind LIKE 'api.error:%'`);
  return rows[0].n;
}

describe.skipIf(!hasTestDb)('H: independent re-verification of the review fixes', { timeout: 120_000 }, () => {
  let owner: Agent;

  beforeAll(async () => {
    owner = await ownerAgent();
  });
  afterAll(async () => {
    setEmailTransport(null);
    await pool.end();
  });

  // ------------------------------------------------------------------------------------------ F-01 / E-01
  it('E-01: 5 wrong passwords from one address cannot lock an Owner out; the right password + TOTP from another address signs in', async () => {
    const target = await makeEmployee('owner');
    await withTransaction((tx) => storeEnrolledSecret(tx, target.id, DEV_TOTP_SECRET));
    await behindLoopbackProxy(async () => {
      for (let i = 0; i < config.lockout.maxFailures; i++) {
        const r = await loginFrom('203.0.113.66', target.email, 'Attacker-guess-0001');
        expect(r.status).toBe(401);
        expect(r.body.code).toBe('INVALID_CREDENTIALS');
      }
      const blocked = await loginFrom('203.0.113.66', target.email, PASSWORD);
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe('RATE_LIMITED');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

      const real = await loginFrom('198.51.100.10', target.email, PASSWORD);
      expect(real.status, JSON.stringify(real.body)).toBe(200);
      expect(real.body.requires2FA).toBe(true);
      const v = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Cookie', cookieFrom(real))
        .set('Origin', ORIGIN)
        .set('X-Forwarded-For', '198.51.100.10')
        .set('X-CSRF-Token', real.body.csrfToken)
        .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
      expect(v.status).toBe(200);
      const list = await request(app).get('/api/employees').set('Cookie', cookieFrom(v));
      expect(list.status).toBe(200);
    });
    const { rows } = await query<{ locked_until: Date | null }>('SELECT locked_until FROM credentials WHERE employee_id = $1', [target.id]);
    expect(rows[0].locked_until).toBeNull();
    // The failures are audited (the attack stays visible), with the attacker's address.
    const { rows: au } = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE event_name = 'login.failed' AND entity_id = $1 AND client_ip::text LIKE '203.0.113.66%'`,
      [target.id]
    );
    expect(au[0].n).toBe(config.lockout.maxFailures);
  });

  it('E-01: case variants of the email share one (email, IP) bucket; rotating inside one IPv6 /64 gives no fresh bucket', async () => {
    const target = await makeEmployee('developer');
    const variants = [target.email, target.email.toUpperCase(), target.email.replace(/^h/, 'H'), target.email.toUpperCase(), target.email];
    await behindLoopbackProxy(async () => {
      for (const v of variants) expect((await loginFrom('203.0.113.67', v, 'Attacker-guess-0002')).status).toBe(401);
      expect((await loginFrom('203.0.113.67', target.email, PASSWORD)).status).toBe(429);
      for (let i = 1; i <= config.lockout.maxFailures; i++) {
        expect((await loginFrom(`2001:db8:aa:bb::${i}`, target.email, 'Attacker-guess-0003')).status).toBe(401);
      }
      expect((await loginFrom('2001:db8:aa:bb:ffff::77', target.email, PASSWORD)).status).toBe(429);
      expect((await loginFrom('2001:db8:aa:bc::1', target.email, PASSWORD)).status).toBe(200);
    });
  });

  it('F-01: office NAT: 40 successful sign-ins of 8 different employees from one address are never limited', async () => {
    const staff = await Promise.all(Array.from({ length: 8 }, (_, i) => makeEmployee(i % 2 ? 'call_center' : 'data_entry')));
    await behindLoopbackProxy(async () => {
      for (let round = 0; round < 5; round++) {
        for (const s of staff) expect((await loginFrom('192.0.2.10', s.email, PASSWORD)).status).toBe(200);
      }
    });
  });

  // ------------------------------------------------------------------------------------------ F-05
  it('F-05: the per-email reset cap holds across addresses (attacker rotating IPs) and the answer never changes', async () => {
    const victim = await makeEmployee('developer');
    await behindLoopbackProxy(async () => {
      const bodies = [];
      for (let i = 0; i < 6; i++) {
        const r = await request(app)
          .post('/api/auth/password-reset/request')
          .set('Origin', ORIGIN)
          .set('X-Forwarded-For', `198.18.${i}.1`)
          .send({ email: victim.email.toUpperCase() });
        expect(r.status).toBe(202);
        bodies.push(JSON.stringify(r.body));
      }
      expect(new Set(bodies).size).toBe(1);
    });
    const { rows } = await query<{ n: number }>(`SELECT count(*)::int AS n FROM security_tokens WHERE employee_id = $1 AND purpose = 'password_reset'`, [victim.id]);
    expect(rows[0].n).toBe(3);
  });

  // ------------------------------------------------------------------------------------------ E-02 / E-08
  it('E-02 / S-26: no Owner-only row can be put on a custom role by create or by edit; a holder never reaches those routes', async () => {
    const OWNER_ONLY = ['employee.list', 'employee.read', 'employee.read_open_items', 'attendance.correction.review', 'attendance.adjust',
      'attendance.retroactive_create', 'attendance.remote_exception.grant', 'attendance.failed_checkout.review', 'attendance.overview.read',
      'employee.create', 'deal.finalize', 'report.export', 'access.role.manage'];
    for (const action of OWNER_ONLY) {
      for (const dataScope of ['global', 'assigned_only', 'self']) {
        const r = await call(owner, 'post', '/api/access/roles', { id: `h_${uniq().replace(/\W/g, '')}`, name: 'H probe', permissions: [{ action, dataScope }] });
        expect(r.status, `${action}/${dataScope}: ${JSON.stringify(r.body)}`).toBe(400);
      }
    }
    const roleId = `h_ops_${uniq().replace(/\W/g, '')}`;
    const made = await call(owner, 'post', '/api/access/roles', { id: roleId, name: 'H Ops', permissions: [{ action: 'business.read', dataScope: 'global' }] });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    const v = made.body.role.version;
    for (const action of ['employee.list', 'attendance.adjust', 'attendance.remote_exception.grant']) {
      const upd = await call(owner, 'patch', `/api/access/roles/${roleId}`, { version: v, permissions: [{ action, dataScope: 'global' }] });
      expect(upd.status, `${action}: ${JSON.stringify(upd.body)}`).toBe(400);
    }
    const { rows } = await query<{ action: string }>('SELECT action FROM role_permissions WHERE role_id = $1', [roleId]);
    expect(rows.map((r) => r.action)).toEqual(['business.read']);
    // A holder, even with an enrolled + verified second factor, is refused every Owner-only route.
    const holder = await makeEmployee(roleId);
    await withTransaction((tx) => storeEnrolledSecret(tx, holder.id, DEV_TOTP_SECRET));
    const s = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: holder.email, password: PASSWORD });
    const ver = await request(app).post('/api/auth/2fa/verify').set('Cookie', cookieFrom(s)).set('Origin', ORIGIN).set('X-CSRF-Token', s.body.csrfToken)
      .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
    expect(ver.status).toBe(200);
    const h: Agent = { cookie: cookieFrom(ver), csrf: ver.body.csrfToken, ...holder };
    for (const [m, p, b] of [
      ['get', '/api/employees', undefined],
      ['get', '/api/attendance/overview', undefined],
      ['get', `/api/employees/${owner.id}`, undefined],
      ['post', '/api/attendance/remote-exceptions', { employeeId: owner.id, startDate: '2030-01-01', reason: 'x' }],
      ['post', '/api/attendance/sessions', { employeeId: owner.id, checkInAt: '2026-01-06T07:00:00Z', checkOutAt: '2026-01-06T15:00:00Z', reason: 'x' }],
    ] as const) {
      const r = await call(h, m, p, b);
      expect(r.status, `${m} ${p}`).toBe(403);
      expect(r.body.code, `${m} ${p}`).toBe('FORBIDDEN_ROLE');
    }
  });

  it('E-08 / D15: a custom role with deal.read at global scope does not see an unassigned accepted opportunity (list, detail, call notes)', async () => {
    const roleId = `h_sales_${uniq().replace(/\W/g, '')}`;
    const made = await call(owner, 'post', '/api/access/roles', {
      id: roleId,
      name: 'H Sales',
      permissions: [{ action: 'deal.read', dataScope: 'global' }, { action: 'business.read', dataScope: 'global' }, { action: 'business.list', dataScope: 'global' }],
    });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    const holder = await agentFor(roleId);
    const cc = await makeEmployee('call_center');
    const { rows: b } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [`H opp ${uniq()}`, owner.id]);
    await query(`INSERT INTO calling_assignments (business_id, assignee_id, assigned_by) VALUES ($1, $2, $3)`, [b[0].id, cc.id, owner.id]);
    const { rows: at } = await query<{ id: string }>(
      `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key, notes) VALUES ($1, $2, 'accepted', $3, 'SECRET-CALL-NOTE') RETURNING id`,
      [b[0].id, cc.id, crypto.randomUUID()]
    );
    const { dealId } = await runSystemCommand('h.accept', (ctx) =>
      createAcceptedOpportunity(ctx, { businessId: b[0].id, callAttemptId: at[0].id, acceptingAgentId: cc.id, clientNeedsNote: 'H needs note SECRET' })
    );
    const list = await call(holder, 'get', '/api/deals?pageSize=100');
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(dealId);
    expect([403, 404]).toContain((await call(holder, 'get', `/api/deals/${dealId}`)).status);
    const notes = await call(holder, 'get', `/api/deals/${dealId}/call-notes`);
    expect([403, 404]).toContain(notes.status);
    expect(JSON.stringify(notes.body)).not.toContain('SECRET');
    // The Owner sees it.
    expect((await call(owner, 'get', `/api/deals/${dealId}`)).status).toBe(200);
  });

  // ------------------------------------------------------------------------------------------ C-01 / C-07
  it('C-01 / C-07: impossible dates, NUL bytes, huge numbers and odd query shapes are 400 (never 500, no ops alert)', async () => {
    const before = await apiErrorAlerts();
    const de = await agentFor('data_entry');
    const emp = await makeEmployee('call_center');
    const { rows: b } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [`H c01 ${uniq()}`, owner.id]);
    const { rows: at } = await query<{ id: string }>(
      `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1, $2, 'accepted', $3) RETURNING id`,
      [b[0].id, emp.id, crypto.randomUUID()]
    );
    const { dealId } = await runSystemCommand('h.accept', (ctx) =>
      createAcceptedOpportunity(ctx, { businessId: b[0].id, callAttemptId: at[0].id, acceptingAgentId: emp.id, clientNeedsNote: 'H needs a site' })
    );
    const { rows: dv } = await query<{ version: number }>('SELECT version FROM deals WHERE id = $1', [dealId]);
    const biz = (o: object) => ({ name: `H biz ${uniq()}`, category: 'Other', phones: [phone()], social: [{ platform: 'instagram', handle: `@h${uniq()}`, followers: null, lastPost: null }], website: null, confirmSimilar: true, ...o });

    const gets = [
      '/api/attendance/sessions?from=2026-02-30',
      '/api/attendance/me/sessions?from=2026-13-01',
      '/api/meetings?from=not-a-date',
      '/api/deals?from=2026-02-29',
      '/api/deals?from[]=2026-01-01',
      '/api/businesses?page[x]=1',
      '/api/notifications?page=99999999999999999999999',
      '/api/employees?q=a%00b',
      '/api/audit-events?to=2026-04-31',
      '/api/attendance/overview?date=2026-02-30',
      '/api/attendance/days-off?from=2025-02-29',
      '/api/calling/queue?bucket=%00',
    ];
    for (const p of gets) {
      const r = await call(owner, 'get', p);
      expect(r.status, `${p} ${JSON.stringify(r.body)}`).toBeLessThan(500);
      expect(r.status, `${p}`).toBe(400);
    }
    const posts: Array<[Agent, 'post' | 'patch', string, object]> = [
      [de, 'post', '/api/businesses', biz({ name: 'a\u0000b' })],
      [de, 'post', '/api/businesses', biz({ notes: 'n\u0000' })],
      [de, 'post', '/api/businesses', biz({ social: [{ platform: 'instagram', handle: '@x', followers: null, lastPost: '2026-02-31' }] })],
      [de, 'post', '/api/businesses', biz({ social: [{ platform: 'instagram', handle: '@x', followers: 1e300, lastPost: null }] })],
      [owner, 'post', '/api/employees', { email: `h.${uniq()}@test.local`, fullName: 'Bad\u0000Name', role: 'developer' }],
      [owner, 'post', '/api/categories', { name: 'cat\u0000' }],
      [owner, 'post', '/api/attendance/remote-exceptions', { employeeId: emp.id, startDate: '2026-02-31', reason: 'x' }],
      [owner, 'post', '/api/attendance/remote-exceptions', { employeeId: emp.id, startDate: '2030-01-01', reason: 'r\u0000' }],
      [owner, 'post', '/api/attendance/days-off', { employeeId: emp.id, startDate: '2030-02-30', reason: 'x' }],
      [owner, 'post', '/api/attendance/corrections', { proposedCheckInAt: '2026-02-31T09:00:00Z', proposedCheckOutAt: '2026-03-01T09:00:00Z', reason: 'x' }],
      [owner, 'post', '/api/work-items', { assigneeId: emp.id, title: 'x', dueDate: '2026-02-29' }],
      [owner, 'post', '/api/targets', { employeeId: emp.id, metric: 'outreach_calls', period: 'daily', targetValue: 1e308, startDate: '2100-01-01' }],
      [owner, 'post', `/api/deals/${dealId}/payment`, { version: dv[0].version, date: '0000-01-01' }],
      [owner, 'post', `/api/deals/${dealId}/payment`, { version: dv[0].version, date: '2026-02-30' }],
      [owner, 'post', `/api/deals/${dealId}/payment`, { version: dv[0].version, date: '2999-01-01' }],
      [owner, 'post', `/api/deals/${dealId}/signature`, { version: dv[0].version, date: '2999-01-01', reference: 'AGR' }],
      [owner, 'post', `/api/deals/${dealId}/contract`, { version: dv[0].version, amount: 1e300, currency: 'USD' }],
      [owner, 'patch', `/api/employees/${emp.id}`, { version: 1, fullName: 'x\u0000' }],
    ];
    for (const [a, m, p, body] of posts) {
      const r = await call(a, m, p, body);
      expect(r.status, `${m} ${p} ${JSON.stringify(body).slice(0, 120)} -> ${JSON.stringify(r.body).slice(0, 200)}`).toBe(400);
    }
    // Nothing was persisted by the refused payment/signature (the deal is still an accepted opportunity).
    const { rows: d2 } = await query<{ stage: string; version: number }>('SELECT stage, version FROM deals WHERE id = $1', [dealId]);
    expect(d2[0]).toEqual({ stage: 'accepted_opportunity', version: dv[0].version });
    expect(await apiErrorAlerts()).toBe(before);
  });

  // ------------------------------------------------------------------------------------------ S-27
  it('S-27 through the API: a phone removed by an edit still blocks a different business (create and edit), and the original may take it back', async () => {
    const de = await agentFor('data_entry');
    const x = phone();
    const y = phone();
    const body = (o: object) => ({ name: `H s27 ${uniq()}`, category: 'Other', phones: [x], social: [{ platform: 'instagram', handle: `@h${uniq()}`, followers: null, lastPost: null }], website: null, confirmSimilar: true, ...o });
    const a = await call(de, 'post', '/api/businesses', body({ phones: [x, y] }));
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    const edit = await call(de, 'patch', `/api/businesses/${a.body.id}`, { version: a.body.version, phones: [y] });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    expect(edit.body.phones.map((p: { normalized: string }) => p.normalized)).toEqual([`+961${y.number}`]);

    const other = await call(de, 'post', '/api/businesses', body({ phones: [x] }));
    expect(other.status).toBe(409);
    expect(other.body.code).toBe('DUPLICATE_BLOCKED');
    const b = await call(de, 'post', '/api/businesses', body({ phones: [phone()] }));
    expect(b.status).toBe(201);
    const steal = await call(de, 'patch', `/api/businesses/${b.body.id}`, { version: b.body.version, phones: [x] });
    expect(steal.status, JSON.stringify(steal.body)).toBe(409);
    expect(steal.body.code).toBe('DUPLICATE_BLOCKED');
    const check = await call(de, 'post', '/api/businesses/duplicate-check', { phones: [x] });
    expect(check.body.blocked).toBe(true);
    const back = await call(de, 'patch', `/api/businesses/${a.body.id}`, { version: edit.body.version, phones: [y, x] });
    expect(back.status, JSON.stringify(back.body)).toBe(200);
  });

  // ------------------------------------------------------------------------------------------ C-02 / C-06 / R-02
  it('C-02 / C-06 / R-02: scoped roles page deals, projects and businesses without gaps or repeats; past the end is 200 with the real total', async () => {
    const dv = await agentFor('developer');
    const cc = await agentFor('call_center');
    const ccId = cc.id;
    const tag = uniq();
    const dealIds: string[] = [];
    for (let i = 0; i < 9; i++) {
      const { rows: b } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [`H page ${i} ${tag}`, owner.id]);
      await query(`INSERT INTO calling_assignments (business_id, assignee_id, assigned_by) VALUES ($1, $2, $3)`, [b[0].id, ccId, owner.id]);
      const { rows: at } = await query<{ id: string }>(
        `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1, $2, 'accepted', $3) RETURNING id`,
        [b[0].id, ccId, crypto.randomUUID()]
      );
      const r = await runSystemCommand('h.accept', (ctx) =>
        createAcceptedOpportunity(ctx, { businessId: b[0].id, callAttemptId: at[0].id, acceptingAgentId: ccId, clientNeedsNote: 'H paging note', developerId: dv.id })
      );
      dealIds.push(r.dealId);
    }
    // Identical timestamps: only a tie-breaker keeps OFFSET paging stable.
    await query(`UPDATE deals SET created_at = '2026-06-01T00:00:00Z', updated_at = '2026-06-01T00:00:00Z' WHERE id = ANY($1::uuid[])`, [dealIds]);
    await query(`UPDATE businesses SET created_at = '2026-06-01T00:00:00Z', updated_at = '2026-06-01T00:00:00Z' WHERE name LIKE $1`, [`H page % ${tag}`]);
    // Three of them closed (Owner finalize) so the Developer also has projects.
    for (const id of dealIds.slice(0, 3)) {
      const ver = async () => (await query<{ version: number }>('SELECT version FROM deals WHERE id = $1', [id])).rows[0].version;
      expect((await call(dv, 'post', `/api/deals/${id}/payment`, { version: await ver(), date: '2026-10-20', reference: 'P' })).status).toBe(200);
      expect((await call(dv, 'post', `/api/deals/${id}/signature`, { version: await ver(), date: '2026-10-21', reference: 'A' })).status).toBe(200);
      expect((await call(owner, 'post', `/api/deals/${id}/finalize`, { version: await ver() })).status).toBe(200);
    }
    await relayAll();
    const { rows: pr } = await query<{ id: string; version: number }>('SELECT id, version FROM projects WHERE deal_id = ANY($1::uuid[])', [dealIds.slice(0, 3)]);
    expect(pr).toHaveLength(3);
    for (const p of pr) {
      const r = await call(owner, 'post', `/api/projects/${p.id}/developers`, { version: p.version, developerIds: [dv.id] });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }
    await query(`UPDATE projects SET created_at = '2026-06-02T00:00:00Z', updated_at = '2026-06-02T00:00:00Z' WHERE id = ANY($1::uuid[])`, [pr.map((p) => p.id)]);

    const walk = async (a: Agent, path: string, size: number) => {
      const seen: string[] = [];
      let total = -1;
      for (let page = 1; page <= 50; page++) {
        const r = await call(a, 'get', `${path}${path.includes('?') ? '&' : '?'}pageSize=${size}&page=${page}`);
        expect(r.status, `${path} p${page} ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
        if (total === -1) total = r.body.total;
        expect(r.body.total, `${path} total stable`).toBe(total);
        if (r.body.items.length === 0) break;
        for (const it of r.body.items) seen.push(it.id ?? it.dealId);
      }
      expect(new Set(seen).size, `${path} no repeats`).toBe(seen.length);
      expect(seen.length, `${path} no gaps`).toBe(total);
      const far = await call(a, 'get', `${path}${path.includes('?') ? '&' : '?'}pageSize=${size}&page=999`);
      expect(far.status, `${path} far ${JSON.stringify(far.body).slice(0, 200)}`).toBe(200);
      expect(far.body.items).toEqual([]);
      expect(far.body.total).toBe(total);
      return seen;
    };
    const dvDeals = await walk(dv, '/api/deals', 2);
    for (const id of dealIds) expect(dvDeals).toContain(id);
    const dvProjects = await walk(dv, '/api/projects', 2);
    for (const p of pr) expect(dvProjects).toContain(p.id);
    const ccBiz = await walk(cc, '/api/businesses', 2);
    expect(ccBiz.length).toBeGreaterThanOrEqual(9);
  });

  // ------------------------------------------------------------------------------------------ C-03
  it('C-03: three parallel auto-fills for every agent never push any queue past the cap (two agents, the original repro)', async () => {
    const a1 = await makeEmployee('call_center');
    const a2 = await makeEmployee('call_center');
    const tag = uniq();
    await query(
      `WITH b AS (INSERT INTO businesses (name, created_by, created_at)
                  SELECT 'H cap ' || g || '.${tag}', $1, now() - interval '2 years' - g * interval '1 second' FROM generate_series(1, 110) g RETURNING id)
       INSERT INTO business_phones (business_id, country_code, number, normalized_phone)
       SELECT id, '+961', '3', '+9618' || substr(md5(id::text), 1, 9) FROM b`,
      [owner.id]
    );
    const results = await Promise.all([1, 2, 3].map(() => call(owner, 'post', '/api/calling-assignments/autofill', {})));
    // H-03 (fixed): a concurrent run is refused at once with 409 AUTOFILL_RUNNING (nothing assigned), never a
    // 503 after lock_timeout. At least one run must succeed.
    for (const r of results) expect([200, 409], JSON.stringify(r.body).slice(0, 300)).toContain(r.status);
    for (const r of results.filter((x) => x.status === 409)) expect(r.body.code).toBe('AUTOFILL_RUNNING');
    expect(results.some((r) => r.status === 200)).toBe(true);
    const { rows } = await query<{ assignee_id: string; n: number }>(
      `SELECT assignee_id, count(*)::int n FROM calling_assignments WHERE assignee_id = ANY($1::uuid[]) AND ended_at IS NULL GROUP BY assignee_id`,
      [[a1.id, a2.id]]
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.n, r.assignee_id).toBeLessThanOrEqual(40);
    // No business is assigned twice.
    const dup = await query(`SELECT business_id FROM calling_assignments WHERE ended_at IS NULL GROUP BY business_id HAVING count(*) > 1`);
    expect(dup.rowCount).toBe(0);
  });

  // ------------------------------------------------------------------------------------------ C-08 / D-03 (e-mail)
  it('D-03 (e-mail): two concurrent dispatchers send a security e-mail once; C-08: a crashing send fails visibly after the cap', async () => {
    const emp = await makeEmployee('developer');
    await relayAll();
    for (let i = 0; i < 100; i++) if ((await dispatchDueDeliveries()).claimed === 0) break;
    mailSink.clear();
    expect((await request(app).post('/api/auth/password-reset/request').set('Origin', ORIGIN).send({ email: emp.email })).status).toBe(202);
    await relayAll();
    await Promise.all([dispatchDueDeliveries(), dispatchDueDeliveries(), dispatchDueDeliveries()]);
    expect(mailSink.messages().filter((m) => m.to === emp.email)).toHaveLength(1);

    // Poison send: the transport throws every time. After the retries the row is failed, not pending forever.
    const emp2 = await makeEmployee('developer');
    setEmailTransport({ kind: 'memory', send: async () => { throw new Error('boom'); } } as never);
    try {
      expect((await request(app).post('/api/auth/password-reset/request').set('Origin', ORIGIN).send({ email: emp2.email })).status).toBe(202);
      await relayAll();
      for (let i = 0; i < 8; i++) {
        await query(`UPDATE notification_deliveries SET next_attempt_at = now() - interval '1 second', lease_until = NULL WHERE recipient_id = $1 AND state IN ('pending','retry_pending')`, [emp2.id]);
        await dispatchDueDeliveries();
      }
    } finally {
      setEmailTransport(null);
    }
    const { rows } = await query<{ state: string; attempt_count: number }>(
      `SELECT state, attempt_count FROM notification_deliveries WHERE recipient_id = $1 AND template = 'security.password_reset'`,
      [emp2.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe('failed');
    expect(rows[0].attempt_count).toBeLessThanOrEqual(4);
  });

  // ------------------------------------------------------------------------------------------ B-02 contract
  it('B-02: grant / list / request / approve / reject / revoke as the Owner screen calls them (frontend lib/api/attendance.ts)', async () => {
    const emp = await agentFor('developer');
    // grantRemoteException(input) → POST /remote-exceptions { employeeId, startDate, endDate?, reason }
    const g = await call(owner, 'post', '/api/attendance/remote-exceptions', { employeeId: emp.id, startDate: '2030-03-04', endDate: '2030-03-06', reason: 'Client visit' });
    expect(g.status, JSON.stringify(g.body)).toBe(201);
    for (const k of ['id', 'version', 'status', 'startDate', 'endDate', 'reason', 'employeeName']) expect(g.body, k).toHaveProperty(k);
    expect(g.body.status).toBe('granted');
    // listRemoteExceptions({ employeeId, status, page, pageSize })
    const l = await call(owner, 'get', `/api/attendance/remote-exceptions?employeeId=${emp.id}&status=granted&page=1&pageSize=50`);
    expect(l.status).toBe(200);
    expect(l.body.items.map((i: { id: string }) => i.id)).toContain(g.body.id);
    // decideRemoteException(d, 'revoke', reason?) → { version, reason } (UI requires a reason; server allows none).
    const rv = await call(owner, 'post', `/api/attendance/remote-exceptions/${g.body.id}/revoke`, { version: g.body.version, reason: 'Trip cancelled' });
    expect(rv.status, JSON.stringify(rv.body)).toBe(200);
    expect(rv.body.status).toBe('revoked');
    const stale = await call(owner, 'post', `/api/attendance/remote-exceptions/${g.body.id}/approve`, { version: g.body.version });
    expect(stale.status).toBe(409);
    // reject needs a reason; approve with reason undefined (the UI sends `reason: undefined`).
    const { rows: rq } = await query<{ id: string }>(
      `INSERT INTO remote_exceptions (employee_id, start_date, end_date, reason, status, requested_by)
       VALUES ($1, '2030-04-01', '2030-04-01', 'Plumber at home', 'requested', $1) RETURNING id`,
      [emp.id]
    );
    {
      const noReason = await call(owner, 'post', `/api/attendance/remote-exceptions/${rq[0].id}/reject`, { version: 1 });
      expect(noReason.status).toBe(400);
      const ok = await call(owner, 'post', `/api/attendance/remote-exceptions/${rq[0].id}/approve`, { version: 1 });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body.status).toBe('granted');
    }
    // Non-Owner roles are refused every Owner route the screen uses.
    for (const [m, p, b] of [
      ['post', '/api/attendance/remote-exceptions', { employeeId: emp.id, startDate: '2030-03-04', reason: 'x' }],
      ['post', `/api/attendance/remote-exceptions/${g.body.id}/approve`, { version: 1 }],
      ['post', `/api/attendance/remote-exceptions/${g.body.id}/revoke`, { version: 1 }],
    ] as const) {
      expect((await call(emp, m, p, b)).body.code).toBe('FORBIDDEN_ROLE');
    }
    // Self-grant is refused even for the Owner (D3/D4).
    const self = await call(owner, 'post', '/api/attendance/remote-exceptions', { employeeId: owner.id, startDate: '2030-03-04', reason: 'me' });
    expect(self.status).toBe(403);
    // Audited.
    const { rows: au } = await query<{ event_name: string }>(`SELECT event_name FROM audit_events WHERE entity_id = $1 ORDER BY created_at`, [g.body.id]);
    expect(au.map((a) => a.event_name)).toEqual(expect.arrayContaining(['attendance.remote_exception_revoked']));
  });

  // ------------------------------------------------------------------------------------------ C-19
  it('C-19 / S-25: break allowance boundary: 59 min used → a new break may start; exactly 60 min used → 409 BREAK_ALLOWANCE_USED', async () => {
    setAttendanceFlagOverridesForTests({ 'attendance.breaksEnabled': true });
    try {
      const cur = await call(owner, 'get', '/api/attendance/settings');
      const put = await call(owner, 'put', '/api/attendance/settings', {
        version: cur.body.current?.versionNo ?? 0, timezone: 'Asia/Beirut', workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'], shiftStart: '09:00', graceMinutes: 10,
        verificationMode: 'ip', officeIps: ['127.0.0.1', '::1', '::ffff:127.0.0.1'], holidays: [], holidaysConfirmed: true, missingCheckoutFlagHours: 6,
        breakAllowanceMinutes: 60, maxBreaksPerSession: 3,
      });
      expect(put.status, JSON.stringify(put.body)).toBe(200);
      const run = async (minutes: number) => {
        const e = await agentFor('call_center');
        const t0 = new Date('2026-11-03T09:00:00+02:00');
        clock.set(t0);
        expect((await call(e, 'post', '/api/attendance/check-in', {})).status).toBe(201);
        clock.set(new Date(t0.getTime() + 60_000));
        expect((await call(e, 'post', '/api/attendance/breaks/start', { breakType: 'unpaid' })).status).toBe(201);
        clock.set(new Date(t0.getTime() + (1 + minutes) * 60_000));
        expect((await call(e, 'post', '/api/attendance/breaks/end', {})).status).toBe(200);
        clock.set(new Date(t0.getTime() + (2 + minutes) * 60_000));
        return call(e, 'post', '/api/attendance/breaks/start', { breakType: 'unpaid' });
      };
      expect((await run(59)).status).toBe(201);
      const used = await run(60);
      expect(used.status).toBe(409);
      expect(used.body.details.reason).toBe('BREAK_ALLOWANCE_USED');
    } finally {
      clock.set(null);
      setAttendanceFlagOverridesForTests({});
    }
  });

  // ------------------------------------------------------------------------------------------ E-07
  it('E-07: attendee options never list the staff directory to Call Center or Developer (ids, names and roles only)', async () => {
    const de = await makeEmployee('data_entry');
    const otherCc = await makeEmployee('call_center');
    const otherDv = await makeEmployee('developer');
    for (const role of ['call_center', 'developer']) {
      const who = await agentFor(role);
      const r = await call(who, 'get', '/api/meetings/attendee-options');
      expect(r.status).toBe(200);
      const items = r.body.items as Array<Record<string, unknown>>;
      const ids = items.map((i) => i.id);
      for (const hidden of [de.id, otherCc.id, otherDv.id]) expect(ids, role).not.toContain(hidden);
      for (const it of items) {
        expect(Object.keys(it).sort()).toEqual(['fullName', 'id', 'role']);
        expect(it.id === who.id || it.role === 'owner', role).toBe(true);
      }
      expect(JSON.stringify(r.body)).not.toMatch(/@test\.local|\+961/);
    }
  });
});
