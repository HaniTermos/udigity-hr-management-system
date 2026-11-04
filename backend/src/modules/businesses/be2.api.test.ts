/**
 * BE2 Increment 3 API tests on the Docker test DB (TEST_DATABASE_URL = udigity_test_be2). Owner: BE2.
 * Covers /api/businesses, /api/categories, /api/search, /api/correction-requests:
 * every endpoint × every role (authz §4.1), IDOR, hidden-record cases (§4.3), VT-7 day-16 boundary through
 * the API (both the configured timezone and the R4 fail-closed zone), duplicate rules and races (DR-8),
 * DEC-015 both branches, SM-DATAFIX-001 transitions, mass assignment, version conflicts.
 *
 * The app is assembled here from identity + BE2 routers (same middleware order as app.ts) so the suite does
 * not depend on modules outside BE2's scope. Rows are uniquely tagged and never deleted (FKs RESTRICT).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { authenticator } from 'otplib';
import { config } from '../../config/index.js';
import { pool, query } from '../../db/pool.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { originCheck, requestId } from '../../middleware/requestGuards.js';
import { access } from '../../shared/access.js';
import { runSystemCommand } from '../../shared/tx.js';
import identityModule from '../identity/module.js';
import platformModule from '../platform/module.js';
import accessModule from '../access/module.js';
import { setRuleFlagOverridesForTests, unguardedRoutes } from '../access/schemas.js';
import { clock } from '../platform/clock.js';
import businessesModule from './module.js';
import correctionsModule from '../corrections/module.js';
import { releaseForDeactivatedReviewer } from '../corrections/service.js';
import { HIDDEN_MATCH_FIELDS } from '../duplicates/schemas.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
function toAlpha(n: number): string {
  let s = '';
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  } while (n > 0);
  return s;
}

const SEED_OWNER = 'udigity@gmail.com';
const TAG = `be${toAlpha(Date.now())}${toAlpha(Math.floor(Math.random() * 1000000))}`;

type Role = 'owner' | 'data_entry' | 'call_center' | 'developer';
interface Agent {
  cookie: string;
  csrf: string;
  id: string;
  role: Role | 'pending_owner';
}

// ---------------------------------------------------------------------------------------------
// App (identity + BE2 mounts, app.ts middleware order)
// ---------------------------------------------------------------------------------------------

const app = express();
app.use(requestId);
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(originCheck);
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const MODULES = [platformModule, identityModule, accessModule, businessesModule, correctionsModule];
for (const m of MODULES) m.init?.();
for (const m of MODULES) for (const mount of m.mounts) app.use(mount.path, mount.router);
app.use(errorHandler);

const BE2_MOUNTS = [...businessesModule.mounts, ...correctionsModule.mounts];

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

let seq = 0;
const uniq = () => `${TAG}${toAlpha(seq++)}`;
const rnd7 = () => String(Math.floor(1_000_000 + Math.random() * 8_999_999));
const phone = () => ({ countryCode: '+961', number: `7${rnd7()}` });

function cookieFrom(res: request.Response): string {
  const c = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`));
  return c ? c.split(';')[0] : '';
}

async function login(email: string) {
  const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password: PASSWORD });
  return { res, cookie: cookieFrom(res), csrf: res.body.csrfToken as string };
}

type Method = 'get' | 'post' | 'patch' | 'delete';
function call(a: Agent, method: Method, path: string, body?: object, headers: Record<string, string> = {}) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf);
  for (const [k, v] of Object.entries(headers)) r.set(k, v);
  return body ? r.send(body) : r;
}

async function makeEmployee(role: Role, label = 'BE2 Test'): Promise<{ id: string; email: string }> {
  const email = `${uniq()}.${role}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, `${label} ${role} ${TAG}${seq}`, role]
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
  const { rows } = await query<{ id: string }>('SELECT id FROM employees WHERE lower(email) = lower($1)', [SEED_OWNER]);
  const id = rows[0].id;
  await query(
    `UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL, failed_window_started_at = NULL WHERE employee_id = $1`,
    [id]
  );
  const s = await login(SEED_OWNER);
  const v = await call({ cookie: s.cookie, csrf: s.csrf, id, role: 'owner' }, 'post', '/api/auth/2fa/verify', { token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, id, role: 'owner' };
}

async function pendingOwnerAgent(): Promise<Agent> {
  const s = await login(SEED_OWNER);
  return { cookie: s.cookie, csrf: s.csrf, id: '', role: 'pending_owner' };
}

interface BizBody {
  name?: string;
  branch?: string | null;
  category?: string;
  categoryId?: string;
  phones?: { countryCode: string; number: string }[];
  social?: { platform: string; handle: string; followers?: number | null; lastPost?: string | null }[];
  website?: string | null;
  notes?: string | null;
  confirmSimilar?: boolean;
}

function bizBody(over: BizBody = {}): BizBody {
  return {
    name: `${uniq()} Business`,
    category: 'Other',
    phones: [phone()],
    social: [{ platform: 'instagram', handle: `@${uniq()}`, followers: null, lastPost: null }],
    website: null,
    confirmSimilar: true,
    ...over,
  };
}

function createBiz(a: Agent, over: BizBody = {}, key: string = randomUUID()) {
  return call(a, 'post', '/api/businesses', bizBody(over), { 'Idempotency-Key': key });
}

async function created(a: Agent, over: BizBody = {}): Promise<{ id: string; version: number; phones: { normalized: string }[]; name: string }> {
  const r = await createBiz(a, over);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body;
}

async function ageBusiness(id: string, days: number): Promise<void> {
  await query(`UPDATE businesses SET created_at = now() - make_interval(days => $2) WHERE id = $1`, [id, days]);
}

async function assign(businessId: string, agentId: string): Promise<void> {
  await query(`INSERT INTO calling_assignments (business_id, assignee_id) VALUES ($1, $2)`, [businessId, agentId]);
}

async function unassign(businessId: string): Promise<void> {
  await query(`UPDATE calling_assignments SET ended_at = now(), end_reason = 'unassigned' WHERE business_id = $1 AND ended_at IS NULL`, [businessId]);
}

async function auditCount(eventName: string, entityId: string): Promise<number> {
  const { rows } = await query<{ n: number }>('SELECT count(*)::int AS n FROM audit_events WHERE event_name = $1 AND entity_id = $2', [eventName, entityId]);
  return rows[0].n;
}

/** Denials never carry field values (authz §1 rule 6). */
function expectBareDenial(body: Record<string, unknown>, code: string): void {
  expect(body.code).toBe(code);
  expect(Object.keys(body).sort()).toEqual(expect.arrayContaining(['code', 'error']));
  for (const k of Object.keys(body)) expect(['code', 'error', 'requestId']).toContain(k);
}

// ---------------------------------------------------------------------------------------------

describe.skipIf(!hasTestDb)('BE2 Increment 3: businesses, categories, search, corrections (DB)', () => {
  let owner: Agent;
  let de: Agent;
  let de2: Agent;
  let cc: Agent;
  let cc2: Agent;
  let dv: Agent;
  let pending: Agent;
  let all: Agent[];

  beforeAll(async () => {
    owner = await ownerAgent();
    de = await agentFor('data_entry');
    de2 = await agentFor('data_entry');
    cc = await agentFor('call_center');
    cc2 = await agentFor('call_center');
    dv = await agentFor('developer');
    pending = await pendingOwnerAgent();
    all = [owner, de, cc, dv];
  });


  afterEach(() => {
    clock.set(null);
    setRuleFlagOverridesForTests({});
  });

  afterAll(async () => {
    await pool.end();
  });

  // -------------------------------------------------------------------------------------------
  describe('route guards and the role matrix (authz §4.1, §4.5)', () => {
    it('every BE2 route carries a VT-3 guard (security review R2)', () => {
      expect(unguardedRoutes(BE2_MOUNTS)).toEqual([]);
    });

    const Z = '00000000-0000-4000-8000-000000000000';
    const table: { method: Method; path: string; roles: Role[]; body?: object }[] = [
      { method: 'get', path: '/api/businesses', roles: ['owner', 'data_entry', 'call_center', 'developer'] },
      { method: 'post', path: '/api/businesses', roles: ['owner', 'data_entry'], body: {} },
      { method: 'post', path: '/api/businesses/duplicate-check', roles: ['owner', 'data_entry'], body: {} },
      { method: 'post', path: '/api/businesses/duplicate-review-requests', roles: ['data_entry'], body: {} },
      { method: 'get', path: `/api/businesses/${Z}`, roles: ['owner', 'data_entry', 'call_center', 'developer'] },
      { method: 'patch', path: `/api/businesses/${Z}`, roles: ['owner', 'data_entry'], body: { version: 1 } },
      { method: 'post', path: `/api/businesses/${Z}/archive`, roles: ['owner'], body: { version: 1 } },
      { method: 'post', path: `/api/businesses/${Z}/restore`, roles: ['owner'], body: { version: 1 } },
      { method: 'delete', path: `/api/businesses/${Z}`, roles: [] },
      { method: 'get', path: `/api/businesses/${Z}/history`, roles: ['owner', 'data_entry', 'call_center', 'developer'] },
      { method: 'get', path: '/api/categories', roles: ['owner', 'data_entry', 'call_center', 'developer'] },
      { method: 'post', path: '/api/categories', roles: ['owner'], body: {} },
      { method: 'patch', path: `/api/categories/${Z}`, roles: ['owner'], body: {} },
      { method: 'post', path: `/api/categories/${Z}/deactivate`, roles: ['owner'], body: {} },
      { method: 'get', path: '/api/search?q=zz', roles: ['owner', 'data_entry', 'call_center', 'developer'] },
      { method: 'get', path: '/api/correction-requests', roles: ['owner', 'data_entry', 'call_center', 'developer'] },
      { method: 'post', path: '/api/correction-requests', roles: ['owner', 'call_center', 'developer'], body: {} },
      { method: 'get', path: `/api/correction-requests/${Z}`, roles: ['owner', 'data_entry', 'call_center', 'developer'] },
      { method: 'post', path: `/api/correction-requests/${Z}/start-review`, roles: ['owner', 'data_entry'], body: {} },
      { method: 'post', path: `/api/correction-requests/${Z}/release`, roles: ['owner', 'data_entry'], body: { version: 1 } },
      { method: 'post', path: `/api/correction-requests/${Z}/resolve`, roles: ['owner', 'data_entry'], body: {} },
      { method: 'post', path: `/api/correction-requests/${Z}/reject`, roles: ['owner', 'data_entry'], body: {} },
      { method: 'post', path: `/api/correction-requests/${Z}/close-no-change`, roles: ['owner', 'data_entry'], body: {} },
      { method: 'post', path: `/api/correction-requests/${Z}/withdraw`, roles: ['owner', 'call_center', 'developer'], body: { version: 1 } },
    ];

    for (const row of table) {
      it(`${row.method.toUpperCase()} ${row.path}: allowed ${row.roles.join(', ') || 'nobody'}; others 403 FORBIDDEN_ROLE; pending Owner 403`, async () => {
        for (const a of all) {
          const res = await call(a, row.method, row.path, row.body, { 'Idempotency-Key': randomUUID() });
          if (row.roles.includes(a.role as Role)) {
            expect(res.body.code, `${a.role} must pass the guard`).not.toBe('FORBIDDEN_ROLE');
            expect(res.status).not.toBe(500);
          } else {
            expect(res.status, `${a.role} ${row.path}`).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN_ROLE');
          }
        }
        const p = await call(pending, row.method, row.path, row.body);
        expect(p.status).toBe(403);
        expect(p.body.code).toBe('OWNER_2FA_REQUIRED');
      });
    }
  });

  // -------------------------------------------------------------------------------------------
  describe('create (SCR-DE-002) and validation', () => {
    it('reports every failed rule together; nothing is saved (AC-BIZ-001)', async () => {
      const res = await call(de, 'post', '/api/businesses', { name: '', phones: [], social: [], website: null }, { 'Idempotency-Key': randomUUID() });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(Object.keys(res.body.details)).toEqual(expect.arrayContaining(['name', 'category', 'social']));
    });

    it('per-field paths for nested errors; bad website and future last-post date', async () => {
      const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
      const res = await createBiz(de, {
        phones: [{ countryCode: '+961', number: 'abc' }],
        social: [{ platform: 'myspace', handle: 'x', lastPost: future }],
        website: 'not a url',
      });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.details)).toEqual(expect.arrayContaining(['phones.0.number', 'social.0.platform', 'social.0.lastPost', 'website']));
    });

    it('Idempotency-Key is required; a replay returns the stored response without a second insert', async () => {
      const missing = await call(de, 'post', '/api/businesses', bizBody());
      expect(missing.status).toBe(400);
      const key = randomUUID();
      const body = bizBody();
      const a = await call(de, 'post', '/api/businesses', body, { 'Idempotency-Key': key });
      const b = await call(de, 'post', '/api/businesses', body, { 'Idempotency-Key': key });
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(b.headers['idempotent-replayed']).toBe('true');
      expect(b.body.id).toBe(a.body.id);
    });

    it('happy path: Pending/Unassigned calling state, history, audit; Unknown metrics stay null (AC-BIZ-004/006)', async () => {
      const b = await created(de, { website: 'https://example.com/shop', social: [{ platform: 'Instagram', handle: `@${uniq()}`, followers: null, lastPost: null }] });
      const { rows: st } = await query('SELECT 1 FROM business_calling_states WHERE business_id = $1', [b.id]);
      expect(st).toHaveLength(1);
      expect(await auditCount('business.created', b.id)).toBe(1);
      const detail = await call(de, 'get', `/api/businesses/${b.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body).toMatchObject({ access: 'full', callable: true, archived: false, website: 'https://example.com/shop', redactedFields: [] });
      expect(detail.body.social[0]).toMatchObject({ platform: 'instagram', followers: null, lastPost: null, metricsRecordedAt: null });
      const h = await call(de, 'get', `/api/businesses/${b.id}/history`);
      expect(h.status).toBe(200);
      expect(h.body.items[0]).toMatchObject({ kind: 'created', byId: de.id });
    });

    it('known metrics record metrics_recorded_at; followers 0 is a value, not Unknown', async () => {
      const b = await created(de, { social: [{ platform: 'tiktok', handle: `@${uniq()}`, followers: 0, lastPost: '2026-01-02' }] });
      const d = await call(de, 'get', `/api/businesses/${b.id}`);
      expect(d.body.social[0].followers).toBe(0);
      expect(d.body.social[0].lastPost).toBe('2026-01-02');
      expect(d.body.social[0].metricsRecordedAt).not.toBeNull();
    });

    it('no phone: saved, "No phone", not callable (B2 PH-2)', async () => {
      const b = await created(de, { phones: [] });
      const d = await call(de, 'get', `/api/businesses/${b.id}`);
      expect(d.body.callable).toBe(false);
      expect(d.body.flags).toContain('no_phone');
    });

    it('the same phone twice on one record collapses with a notice (VR-6)', async () => {
      const p = phone();
      const b = await createBiz(de, { phones: [p, { countryCode: '961', number: `0${p.number}` }] });
      expect(b.status).toBe(201);
      expect(b.body.phones).toHaveLength(1);
      expect(b.body.phonesCollapsed).toBe(true);
    });

    it('phone without a country code while business.defaultCountryCode is NOT CONFIGURED → 409 POLICY_NOT_CONFIGURED', async () => {
      const res = await createBiz(de, { phones: [{ countryCode: '', number: `7${rnd7()}` }] });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'POLICY_NOT_CONFIGURED', details: { setting: 'business.defaultCountryCode' } });
    });

    it('mass assignment: createdBy / version / override in the body → 400 (strict schemas)', async () => {
      for (const extra of [{ createdBy: owner.id }, { version: 3 }, { override: true }, { archived: true }]) {
        const res = await call(de, 'post', '/api/businesses', { ...bizBody(), ...extra }, { 'Idempotency-Key': randomUUID() });
        expect(res.status).toBe(400);
      }
    });
  });

  // -------------------------------------------------------------------------------------------
  describe('duplicates (DR-1..DR-9, DEC-013, DEC-003)', () => {
    it('phone blocks, across branches too; audited; shown in full to a reader (AC-DUP-001/002/006)', async () => {
      const a = await created(de, { branch: 'Hamra' });
      const res = await createBiz(de2, { branch: 'Jounieh', phones: [{ countryCode: '+961', number: a.phones[0].normalized.slice(4) }] });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_BLOCKED');
      expect(res.body.details).toMatchObject({ visibility: 'visible', id: a.id, matchedOn: 'phone', matchedValue: a.phones[0].normalized });
      expect(await auditCount('business.duplicate_blocked', a.id)).toBeGreaterThanOrEqual(1);
    });

    it('normalised name + same branch blocks; a different branch is allowed (AC-DUP-003/004)', async () => {
      const base = `${uniq()} Glow Salon`;
      const a = await created(de, { name: base, branch: null });
      const same = await createBiz(de, { name: base.toUpperCase().replace(' GLOW', '  glow!'), branch: '' });
      expect(same.status).toBe(409);
      expect(same.body.details).toMatchObject({ visibility: 'visible', id: a.id, matchedOn: 'name' });
      const other = await createBiz(de, { name: base, branch: 'Achrafieh' });
      expect(other.status).toBe(201);
    });

    it('similar name warns (never blocks); confirmSimilar saves and is audited (AC-DUP-005)', async () => {
      const base = `${uniq()} zephyrine bakery`;
      const a = await created(de, { name: base });
      const warn = await createBiz(de, { name: `${base}s`, confirmSimilar: false });
      expect(warn.status).toBe(409);
      expect(warn.body.code).toBe('CONFLICT_DUPLICATE');
      expect(warn.body.details.kind).toBe('similar_name');
      expect(warn.body.details.similar.map((s: { id: string }) => s.id)).toContain(a.id);
      const ok = await createBiz(de, { name: `${base}s`, confirmSimilar: true });
      expect(ok.status).toBe(201);
      expect(await auditCount('business.similar_name_confirmed', ok.body.id)).toBe(1);
    });

    // Changed expectation (approved D10; was `{ visibility: 'hidden' }` only): exactly the matched field type,
    // name, category and creation date; never id, phones, socials, notes or assignee.
    it('D10: a hidden match discloses exactly matchedOn/name/category/createdAt to Data Entry; the Owner sees it in full', async () => {
      const handle = `@${uniq()}secret`;
      const a = await created(de, { notes: 'Private note SECRETNOTE', website: 'secret-site.example', social: [{ platform: 'instagram', handle, followers: 5, lastPost: null }] });
      await assign(a.id, cc.id);
      await ageBusiness(a.id, 16);
      const p = { countryCode: '+961', number: a.phones[0].normalized.slice(4) };
      const deRes = await createBiz(de2, { phones: [p] });
      expect(deRes.status).toBe(409);
      expect(Object.keys(deRes.body.details).sort()).toEqual([...HIDDEN_MATCH_FIELDS].sort());
      expect(deRes.body.details).toEqual({ visibility: 'hidden', matchedOn: 'phone', name: a.name, categoryName: 'Other', createdAt: expect.any(String) });
      const leak = JSON.stringify(deRes.body);
      for (const secret of [a.id, a.phones[0].normalized, handle, 'SECRETNOTE', 'secret-site', cc.id]) expect(leak).not.toContain(secret);
      const check = await call(de2, 'post', '/api/businesses/duplicate-check', { phones: [p] });
      expect(check.status).toBe(200);
      expect(check.body).toEqual({ blocked: true, match: deRes.body.details, similar: [] });
      const byName = await call(de2, 'post', '/api/businesses/duplicate-check', { name: a.name });
      expect(byName.body.match).toMatchObject({ visibility: 'hidden', matchedOn: 'name', name: a.name });
      const ownerRes = await createBiz(owner, { phones: [p] });
      expect(ownerRes.body.details).toMatchObject({ visibility: 'visible', id: a.id });
    });

    it('D10: "Request Owner review" re-derives the match server-side, is audited, notifies Owners, grants no access', async () => {
      const a = await created(de, { notes: 'Private review note' });
      await ageBusiness(a.id, 16);
      const p = { countryCode: '+961', number: a.phones[0].normalized.slice(4) };
      // Client-supplied ids are refused (strict schema): the match is never taken from the client.
      const withId = await call(de2, 'post', '/api/businesses/duplicate-review-requests', { phones: [p], businessId: a.id });
      expect(withId.status).toBe(400);
      const tooLong = await call(de2, 'post', '/api/businesses/duplicate-review-requests', { phones: [p], explanation: 'x'.repeat(501) });
      expect(tooLong.status).toBe(400);
      const none = await call(de2, 'post', '/api/businesses/duplicate-review-requests', { phones: [phone()] });
      expect(none.status).toBe(422);
      const res = await call(de2, 'post', '/api/businesses/duplicate-review-requests', { phones: [p], explanation: 'Same shop, new branch?' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ requested: true, match: { visibility: 'hidden', matchedOn: 'phone', name: a.name, categoryName: 'Other', createdAt: expect.any(String) } });
      const { rows: au } = await query<{ actor_id: string; reason: string; payload: { matchedOn: string } }>(
        `SELECT actor_id, reason, payload FROM audit_events WHERE event_name = 'business.duplicate_review_requested' AND entity_id = $1`,
        [a.id]
      );
      expect(au).toHaveLength(1);
      expect(au[0]).toMatchObject({ actor_id: de2.id, reason: 'Same shop, new branch?', payload: { matchedOn: 'phone' } });
      const { rows: ob } = await query<{ n: number }>(
        `SELECT count(*)::int AS n FROM outbox_events WHERE name = 'business.duplicate_review_requested' AND aggregate_id = $1`,
        [a.id]
      );
      expect(ob[0].n).toBe(1);
      // No access is granted by the request.
      expect((await call(de2, 'get', `/api/businesses/${a.id}`)).status).toBe(403);
      for (const other of [cc, dv]) expect((await call(other, 'post', '/api/businesses/duplicate-review-requests', { phones: [p] })).status).toBe(403);
    });

    it('similar names never list a record the caller cannot read', async () => {
      const base = `${uniq()} quixotic florist`;
      const a = await created(de, { name: base });
      await ageBusiness(a.id, 20);
      const res = await call(de2, 'post', '/api/businesses/duplicate-check', { name: `${base}s` });
      expect(res.body.blocked).toBe(false);
      expect(res.body.similar.map((s: { id: string }) => s.id)).not.toContain(a.id);
      const asOwner = await call(owner, 'post', '/api/businesses/duplicate-check', { name: `${base}s` });
      expect(asOwner.body.similar.map((s: { id: string }) => s.id)).toContain(a.id);
    });

    it('archived records stay in duplicate scope (OI-26)', async () => {
      const a = await created(de);
      const arch = await call(owner, 'post', `/api/businesses/${a.id}/archive`, { version: a.version, reason: 'closed' });
      expect(arch.status).toBe(200);
      const res = await createBiz(de, { phones: [{ countryCode: '+961', number: a.phones[0].normalized.slice(4) }] });
      expect(res.status).toBe(409);
      // Changed expectation (approved D10): the hidden disclosure now carries the five allowed fields.
      expect(res.body.details).toEqual({ visibility: 'hidden', matchedOn: 'phone', name: a.name, categoryName: 'Other', createdAt: expect.any(String) });
    });

    it('a record does not match itself on edit (DR-7); duplicate-check excludes it too', async () => {
      const a = await created(de);
      const same = await call(de, 'patch', `/api/businesses/${a.id}`, { version: a.version, phones: [{ countryCode: '+961', number: a.phones[0].normalized.slice(4) }], name: a.name });
      expect(same.status).toBe(200);
      const chk = await call(de, 'post', '/api/businesses/duplicate-check', { name: a.name, phones: [{ countryCode: '+961', number: a.phones[0].normalized.slice(4) }], excludeBusinessId: a.id });
      expect(chk.body.blocked).toBe(false);
    });

    it('an edit into another record\'s phone is blocked (DR-1 on edit)', async () => {
      const a = await created(de);
      const b = await created(de);
      const res = await call(de, 'patch', `/api/businesses/${b.id}`, { version: b.version, phones: [{ countryCode: '+961', number: a.phones[0].normalized.slice(4) }] });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_BLOCKED');
    });

    it('races: concurrent create/create, edit/create and edit/edit with one phone → exactly one wins (AC-DUP-011)', async () => {
      for (let round = 0; round < 3; round++) {
        const p = phone();
        const results = await Promise.all([createBiz(de, { phones: [p] }), createBiz(de2, { phones: [p] })]);
        expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
        expect(results.find((r) => r.status === 409)?.body.code).toBe('DUPLICATE_BLOCKED');
      }
      const p2 = phone();
      const target = await created(de);
      const [edit, create] = await Promise.all([
        call(de, 'patch', `/api/businesses/${target.id}`, { version: target.version, phones: [p2] }),
        createBiz(de2, { phones: [p2] }),
      ]);
      expect([edit.status, create.status].sort()).toEqual([200, 409]);
      const p3 = phone();
      const x = await created(de);
      const y = await created(de);
      const [e1, e2] = await Promise.all([
        call(de, 'patch', `/api/businesses/${x.id}`, { version: x.version, phones: [p3] }),
        call(de2, 'patch', `/api/businesses/${y.id}`, { version: y.version, phones: [p3] }),
      ]);
      expect([e1.status, e2.status].sort()).toEqual([200, 409]);
      const { rows } = await query<{ n: number }>('SELECT count(*)::int AS n FROM business_phones WHERE normalized_phone = ANY($1)', [
        [p2, p3].map((p) => `+961${p.number}`),
      ]);
      expect(rows[0].n).toBe(2);
    });

    it('DR-8 deterministic race: the app check passes, the UNIQUE index rejects, the answer is a shaped DUPLICATE_BLOCKED', async () => {
      const holder = await created(de);
      const p = phone();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Another writer has the phone uncommitted: the API's pre-check cannot see it.
        await client.query(`INSERT INTO business_phones (business_id, country_code, number, normalized_phone) VALUES ($1, '+961', $2, $3)`, [
          holder.id,
          p.number,
          `+961${p.number}`,
        ]);
        const pendingCreate = createBiz(de2, { phones: [p] }).then((r) => r);
        await new Promise((r) => setTimeout(r, 400)); // the API insert is now waiting on the index
        await client.query('COMMIT');
        const res = await pendingCreate;
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'DUPLICATE_BLOCKED', details: { visibility: 'visible', id: holder.id, matchedOn: 'phone' } });
      } finally {
        client.release();
      }
      const { rows } = await query<{ n: number }>('SELECT count(*)::int AS n FROM business_phones WHERE normalized_phone = $1', [`+961${p.number}`]);
      expect(rows[0].n).toBe(1);
    });

    it('name race: two creates with the same name + branch → one 201, one DUPLICATE_BLOCKED', async () => {
      const name = `${uniq()} twin cafe`;
      const results = await Promise.all([createBiz(de, { name }), createBiz(de2, { name })]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    });

    it('duplicate-check is rate-limited per user (429 RATE_LIMITED after the window budget)', async () => {
      const burst = await agentFor('data_entry');
      let limited = 0;
      for (let i = 0; i < 125; i++) {
        const r = await call(burst, 'post', '/api/businesses/duplicate-check', {});
        if (r.status === 429) limited++;
      }
      expect(limited).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------------------------
  describe('read, edit, archive, history, delete', () => {
    it('detail per role: DE full, Owner owner, CC unassigned / DV unrelated → 403 PERMISSION_DENIED without data; 404s', async () => {
      const b = await created(de);
      expect((await call(de, 'get', `/api/businesses/${b.id}`)).body.access).toBe('full');
      expect((await call(owner, 'get', `/api/businesses/${b.id}`)).body.access).toBe('owner');
      for (const a of [cc, dv]) {
        const r = await call(a, 'get', `/api/businesses/${b.id}`);
        expect(r.status).toBe(403);
        expectBareDenial(r.body, 'PERMISSION_DENIED');
      }
      expect(await auditCount('business_access.denied', b.id)).toBeGreaterThanOrEqual(2);
      expect((await call(de, 'get', `/api/businesses/${randomUUID()}`)).status).toBe(404);
      expect((await call(de, 'get', '/api/businesses/not-a-uuid')).status).toBe(400);
    });

    it('Call Center: the assigned agent reads, lists and searches the business; another agent does not', async () => {
      const b = await created(de);
      await assign(b.id, cc.id);
      const d = await call(cc, 'get', `/api/businesses/${b.id}`);
      expect(d.status).toBe(200);
      expect(d.body.access).toBe('full');
      const list = await call(cc, 'get', `/api/businesses?q=${encodeURIComponent(b.name)}`);
      expect(list.body.items.map((i: { id: string }) => i.id)).toContain(b.id);
      const s = await call(cc, 'get', `/api/search?q=${encodeURIComponent(b.name)}`);
      expect(s.body.items.map((i: { id: string }) => i.id)).toContain(b.id);
      const other = await call(cc2, 'get', `/api/search?q=${encodeURIComponent(b.name)}`);
      expect(other.body.total).toBe(0);
      expect((await call(cc2, 'get', `/api/businesses/${b.id}`)).status).toBe(403);
    });

    it('edit writes one history row per changed field; stale version → 409 VERSION_CONFLICT + business.save_conflicted (AC-BIZ-007/008)', async () => {
      const b = await created(de);
      const r = await call(de, 'patch', `/api/businesses/${b.id}`, { version: b.version, name: `${b.name} renamed`, website: 'example.org', confirmSimilar: true });
      expect(r.status).toBe(200);
      expect(r.body.version).toBe(b.version + 1);
      const h = await call(de, 'get', `/api/businesses/${b.id}/history`);
      const fields = h.body.items.filter((i: { kind: string }) => i.kind === 'updated').map((i: { field: string }) => i.field);
      expect(fields.sort()).toEqual(['name', 'website']);
      expect(await auditCount('business.updated', b.id)).toBe(1);
      const stale = await call(de2, 'patch', `/api/businesses/${b.id}`, { version: b.version, notes: 'x' });
      expect(stale.status).toBe(409);
      expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT', details: { currentVersion: b.version + 1 } });
      // BL-09: the current record (as de2 may see it) rides along for the SHR-014 field diff.
      expect(stale.body.details.current).toMatchObject({ id: b.id, version: b.version + 1 });
      expect(await auditCount('business.save_conflicted', b.id)).toBe(1);
      const mass = await call(de, 'patch', `/api/businesses/${b.id}`, { version: b.version + 1, createdBy: owner.id });
      expect(mass.status).toBe(400);
    });

    it('a deactivated category cannot be chosen; the business keeps its old one (CR-1)', async () => {
      const cat = await call(owner, 'post', '/api/categories', { name: `${uniq()} Cat` });
      const b = await created(de, { category: undefined, categoryId: cat.body.id });
      const off = await call(owner, 'post', `/api/categories/${cat.body.id}/deactivate`, { version: cat.body.version });
      expect(off.body.active).toBe(false);
      const keep = await call(de, 'patch', `/api/businesses/${b.id}`, { version: b.version, notes: 'still here' });
      expect(keep.status).toBe(200);
      expect(keep.body.categoryActive).toBe(false);
      const fresh = await createBiz(de, { category: undefined, categoryId: cat.body.id });
      expect(fresh.status).toBe(400);
      expect(fresh.body.details.category).toBeDefined();
    });

    it('archive / restore: Owner only; leaves the directory and reads for non-Owners; edits refused; repeat is a no-op (C-01)', async () => {
      const b = await created(de);
      const a1 = await call(owner, 'post', `/api/businesses/${b.id}/archive`, { version: b.version, reason: 'closed down' });
      expect(a1.status).toBe(200);
      expect(a1.body.archived).toBe(true);
      expect(a1.body.flags).toContain('archived');
      const again = await call(owner, 'post', `/api/businesses/${b.id}/archive`, { version: b.version });
      expect(again.status).toBe(200);
      expect((await call(de, 'get', `/api/businesses/${b.id}`)).status).toBe(404);
      const deList = await call(de, 'get', `/api/businesses?q=${encodeURIComponent(b.name)}`);
      expect(deList.body.total).toBe(0);
      const ownerOnly = await call(owner, 'get', `/api/businesses?archived=only&q=${encodeURIComponent(b.name)}`);
      expect(ownerOnly.body.items.map((i: { id: string }) => i.id)).toEqual([b.id]);
      const edit = await call(owner, 'patch', `/api/businesses/${b.id}`, { version: a1.body.version, notes: 'x' });
      expect(edit.status).toBe(409);
      expect(edit.body.code).toBe('STATE_CONFLICT');
      const r = await call(owner, 'post', `/api/businesses/${b.id}/restore`, { version: a1.body.version });
      expect(r.status).toBe(200);
      expect(r.body.archived).toBe(false);
      expect(await auditCount('business.archived', b.id)).toBe(1);
      expect(await auditCount('business.restored', b.id)).toBe(1);
      const h = await call(owner, 'get', `/api/businesses/${b.id}/history`);
      expect(h.body.items.map((i: { kind: string }) => i.kind)).toEqual(expect.arrayContaining(['archived', 'restored', 'created']));
    });

    it('DELETE is refused for every role, the Owner included (AC-BIZ-009)', async () => {
      const b = await created(de);
      for (const a of all) {
        const r = await call(a, 'delete', `/api/businesses/${b.id}`);
        expect(r.status).toBe(403);
      }
      const { rows } = await query('SELECT 1 FROM businesses WHERE id = $1', [b.id]);
      expect(rows).toHaveLength(1);
    });

    it('history: denied to unrelated roles with no data; 404 on unknown ids', async () => {
      const b = await created(de);
      const r = await call(cc, 'get', `/api/businesses/${b.id}/history`);
      expect(r.status).toBe(403);
      expectBareDenial(r.body, 'PERMISSION_DENIED');
      expect((await call(owner, 'get', `/api/businesses/${randomUUID()}/history`)).status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------------------------
  describe('hidden records (authz §4.3) and VT-7 through the API', () => {
    it('a 16-day-old business: absent from list, not counted, not found by search, GET 403 HIDDEN_BY_POLICY; Owner reads and is audited', async () => {
      const marker = uniq();
      const visible = await created(de, { name: `${marker} shown` });
      const hidden = await created(de, { name: `${marker} hidden` });
      await ageBusiness(hidden.id, 16);
      const list = await call(de2, 'get', `/api/businesses?q=${marker}`);
      expect(list.body.total).toBe(1);
      expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([visible.id]);
      const search = await call(de2, 'get', `/api/search?q=${marker}`);
      expect(search.body.counts.all).toBe(1);
      expect(search.body.items.map((i: { id: string }) => i.id)).toEqual([visible.id]);
      const get = await call(de2, 'get', `/api/businesses/${hidden.id}`);
      expect(get.status).toBe(403);
      expectBareDenial(get.body, 'HIDDEN_BY_POLICY');
      const hist = await call(de2, 'get', `/api/businesses/${hidden.id}/history`);
      expect(hist.status).toBe(403);
      const edit = await call(de2, 'patch', `/api/businesses/${hidden.id}`, { version: hidden.version, notes: 'x' });
      expect(edit.status).toBe(403);
      expect(edit.body.code).toBe('HIDDEN_BY_POLICY');
      const ownerList = await call(owner, 'get', `/api/businesses?q=${marker}`);
      expect(ownerList.body.total).toBe(2);
      expect(ownerList.body.items.find((i: { id: string }) => i.id === hidden.id).flags).toContain('hidden_from_others');
      expect(await auditCount('business_access.owner_viewed_hidden', hidden.id)).toBe(0); // list rows are not audited
      const ownerGet = await call(owner, 'get', `/api/businesses/${hidden.id}`);
      expect(ownerGet.status).toBe(200);
      expect(await auditCount('business_access.owner_viewed_hidden', hidden.id)).toBe(1);
    });

    // Changed expectation (approved D9; was the company-day boundary at 00:00 on created-date + 15, and the
    // UTC+14 fail-closed zone when the timezone was unset): 15 ELAPSED days, independent of the timezone.
    it('D9 elapsed window through the API: visible until created_at + 15 × 24 h, hidden from that instant (any timezone)', async () => {
      const marker = uniq();
      const b = await created(de, { name: `${marker} boundary` });
      await query(`UPDATE businesses SET created_at = '2026-10-08T21:30:00Z' WHERE id = $1`, [b.id]);
      for (const tz of ['Asia/Beirut', '']) {
        setRuleFlagOverridesForTests({ 'company.timezone': tz });
        clock.set(new Date('2026-10-23T21:29:59Z'));
        expect((await call(de2, 'get', `/api/businesses/${b.id}`)).status, tz).toBe(200);
        expect((await call(de2, 'get', `/api/businesses?q=${marker}`)).body.total).toBe(1);
        expect((await call(de2, 'get', `/api/search?q=${marker}`)).body.total).toBe(1);
        clock.set(new Date('2026-10-23T21:30:00Z'));
        const at = await call(de2, 'get', `/api/businesses/${b.id}`);
        expect(at.status, tz).toBe(403);
        expect(at.body.code).toBe('HIDDEN_BY_POLICY');
        expect((await call(de2, 'get', `/api/businesses?q=${marker}`)).body.total).toBe(0);
        expect((await call(de2, 'get', `/api/search?q=${marker}`)).body.total).toBe(0);
      }
      expect((await call(owner, 'get', `/api/businesses/${b.id}`)).status).toBe(200);
    });

    it('D9 editing does not restart the Data Entry window', async () => {
      const b = await created(de);
      await ageBusiness(b.id, 14);
      const edit = await call(de, 'patch', `/api/businesses/${b.id}`, { version: b.version, notes: 'touch' });
      expect(edit.status).toBe(200);
      await ageBusiness(b.id, 16);
      expect((await call(de2, 'get', `/api/businesses/${b.id}`)).body.code).toBe('HIDDEN_BY_POLICY');
    });

    it('D9 Call Center: window from assignment; reassignment cuts the old agent off at once; the new agent starts fresh', async () => {
      const b = await created(de);
      await ageBusiness(b.id, 40);
      await assign(b.id, cc.id);
      expect((await call(cc, 'get', `/api/businesses/${b.id}`)).status).toBe(200);
      await query(`UPDATE calling_assignments SET ended_at = now(), end_reason = 'reassigned' WHERE business_id = $1 AND ended_at IS NULL`, [b.id]);
      await assign(b.id, cc2.id);
      const old = await call(cc, 'get', `/api/businesses/${b.id}`);
      expect(old.status).toBe(403);
      expect(old.body.code).toBe('PERMISSION_DENIED');
      expect((await call(cc2, 'get', `/api/businesses/${b.id}`)).status).toBe(200);
      await query(`UPDATE calling_assignments SET started_at = now() - interval '15 days 1 minute' WHERE business_id = $1 AND ended_at IS NULL`, [b.id]);
      expect((await call(cc2, 'get', `/api/businesses/${b.id}`)).body.code).toBe('HIDDEN_BY_POLICY');
      await unassign(b.id);
    });

    it('DE-2 branch (OI-02): another creator\'s fresh business is permission denied; DE-1 reads it', async () => {
      const b = await created(de);
      setRuleFlagOverridesForTests({ 'access.dataEntryScope': 'DE-2' });
      expect((await call(de2, 'get', `/api/businesses/${b.id}`)).body.code).toBe('PERMISSION_DENIED');
      expect((await call(de, 'get', `/api/businesses/${b.id}`)).status).toBe(200);
      setRuleFlagOverridesForTests({ 'access.dataEntryScope': 'DE-1' });
      expect((await call(de2, 'get', `/api/businesses/${b.id}`)).status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------------------------
  describe('directory list and search', () => {
    it('list filters, counts and facets; Owner sees creators/categories; sort whitelist', async () => {
      const marker = uniq();
      await created(de, { name: `${marker} alpha`, phones: [] });
      const withSite = await created(de, { name: `${marker} beta`, website: 'beta.example.com' });
      const list = await call(de, 'get', `/api/businesses?q=${marker}&sort=name&order=asc`);
      expect(list.status).toBe(200);
      expect(list.body.items.map((i: { name: string }) => i.name)).toEqual([`${marker} alpha`, `${marker} beta`]);
      expect(list.body.facets.categories).toContain('Other');
      expect((await call(de, 'get', `/api/businesses?q=${marker}&flag=no_phone`)).body.total).toBe(1);
      expect((await call(de, 'get', `/api/businesses?q=${marker}&website=yes`)).body.items[0].id).toBe(withSite.id);
      expect((await call(de, 'get', `/api/businesses?q=${marker}&followers=unknown`)).body.total).toBe(2);
      expect((await call(de, 'get', `/api/businesses?unknown=1`)).status).toBe(400);
      expect((await call(de, 'get', `/api/businesses?pageSize=101`)).status).toBe(400);
    });

    it('search by name, phone digits and handle; q < 2 → 400; DV finds nothing', async () => {
      const handle = `${uniq()}handle`;
      const b = await created(de, { social: [{ platform: 'instagram', handle: `@${handle}` }] });
      const byPhone = await call(de, 'get', `/api/search?q=${b.phones[0].normalized.slice(-7)}&matchType=phone`);
      expect(byPhone.body.items.map((i: { id: string }) => i.id)).toContain(b.id);
      const byHandle = await call(de, 'get', `/api/search?q=${handle}`);
      expect(byHandle.body.items[0]).toMatchObject({ id: b.id, matchedOn: ['social'] });
      expect(byHandle.body.counts).toMatchObject({ social: 1, all: 1, name: 0 });
      expect((await call(de, 'get', '/api/search?q=a')).status).toBe(400);
      // LIKE wildcards in the term are literals: `_` must not match any character.
      const u = uniq();
      const under = await created(de, { social: [{ platform: 'instagram', handle: `@${u}q_z` }] });
      await created(de, { social: [{ platform: 'instagram', handle: `@${u}qxz` }] });
      const wild = await call(de, 'get', `/api/search?q=${u}q_z`);
      expect(wild.body.items.map((i: { id: string }) => i.id)).toEqual([under.id]);
      const dvRes = await call(dv, 'get', `/api/search?q=${handle}`);
      expect(dvRes.status).toBe(200);
      expect(dvRes.body.total).toBe(0);
    });
  });

  // -------------------------------------------------------------------------------------------
  describe('categories (WF-BIZ-003, DEC-015 both branches)', () => {
    it('list: Owner sees inactive ones; other roles active only', async () => {
      const c = await call(owner, 'post', '/api/categories', { name: `${uniq()} Inactive` });
      await call(owner, 'post', `/api/categories/${c.body.id}/deactivate`, { version: c.body.version });
      const o = await call(owner, 'get', '/api/categories?pageSize=100');
      for (const a of [de, cc, dv]) {
        const r = await call(a, 'get', '/api/categories?pageSize=100');
        expect(r.status).toBe(200);
        expect(r.body.items.every((i: { active: boolean }) => i.active)).toBe(true);
        expect(r.body.items.map((i: { name: string }) => i.name)).toContain('Other');
      }
      expect(o.body.total).toBeGreaterThan(0);
    }, 30_000); // 4 role calls; slower on a reused DB with many categories

    it('CA-A (default): Owner creates/renames; Data Entry 403; normalised duplicate → 409 (AC-CAT-001/002)', async () => {
      const name = `${uniq()} Salon`;
      const c = await call(owner, 'post', '/api/categories', { name });
      expect(c.status).toBe(201);
      expect(await auditCount('category.created', c.body.id)).toBe(1);
      const dup = await call(owner, 'post', '/api/categories', { name: `  ${name.toUpperCase()}!` });
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('CONFLICT_DUPLICATE');
      const deTry = await call(de, 'post', '/api/categories', { name: `${uniq()} x` });
      expect(deTry.status).toBe(403);
      expect(deTry.body.code).toBe('FORBIDDEN_ROLE');
      const rn = await call(owner, 'patch', `/api/categories/${c.body.id}`, { name: `${name} Pro`, version: c.body.version });
      expect(rn.status).toBe(200);
      const stale = await call(owner, 'patch', `/api/categories/${c.body.id}`, { name: `${name} Max`, version: c.body.version });
      expect(stale.body.code).toBe('VERSION_CONFLICT');
    });

    // Replaces the CA-B test (approved D12): there is no delegation toggle. Even with the retired env variable
    // set, Data Entry (and CC/DV) cannot create, rename or deactivate categories.
    it('D12: category management is Owner only, even with POLICY_CATEGORIES_DATA_ENTRY_MANAGE=true in the environment', async () => {
      const prev = process.env.POLICY_CATEGORIES_DATA_ENTRY_MANAGE;
      process.env.POLICY_CATEGORIES_DATA_ENTRY_MANAGE = 'true';
      try {
        const own = await call(owner, 'post', '/api/categories', { name: `${uniq()} Gym` });
        expect(own.status).toBe(201);
        for (const a of [de, cc, dv]) {
          expect((await call(a, 'post', '/api/categories', { name: `${uniq()} y` })).body.code).toBe('FORBIDDEN_ROLE');
          expect((await call(a, 'patch', `/api/categories/${own.body.id}`, { name: `${uniq()} z`, version: own.body.version })).body.code).toBe('FORBIDDEN_ROLE');
          expect((await call(a, 'post', `/api/categories/${own.body.id}/deactivate`, { version: own.body.version })).body.code).toBe('FORBIDDEN_ROLE');
        }
        // Data Entry still selects the active categories (the denied management state stays in the UI).
        expect((await call(de, 'get', '/api/categories?pageSize=100')).status).toBe(200);
      } finally {
        if (prev === undefined) delete process.env.POLICY_CATEGORIES_DATA_ENTRY_MANAGE;
        else process.env.POLICY_CATEGORIES_DATA_ENTRY_MANAGE = prev;
      }
    });

    it('"Other" always exists and cannot be deactivated or renamed (OI-21); deactivate is not delete (AC-CAT-003/004)', async () => {
      const list = await call(owner, 'get', '/api/categories?pageSize=100');
      const other = list.body.items.find((i: { system: boolean }) => i.system);
      expect(other.name).toBe('Other');
      const off = await call(owner, 'post', `/api/categories/${other.id}/deactivate`, { version: other.version });
      expect(off.status).toBe(422);
      expect(off.body.code).toBe('RULE_VIOLATION');
      expect((await call(owner, 'patch', `/api/categories/${other.id}`, { name: 'Misc', version: other.version })).status).toBe(422);
      expect((await call(owner, 'post', `/api/categories/${randomUUID()}/deactivate`, { version: 1 })).status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------------------------
  describe('correction requests (SM-DATAFIX-001)', () => {
    async function submitted(by: Agent, businessId: string, over: object = {}) {
      const r = await call(by, 'post', '/api/correction-requests', {
        businessId,
        issueType: 'Incorrect phone',
        description: 'The number rings a different shop',
        suggestedValue: '+961 1 234 567',
        ...over,
      });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      return r.body;
    }

    it('submit: CC with access → Submitted, audited, E-09 outbox; DE 403 role; CC without access 403; DV unrelated 403', async () => {
      const b = await created(de);
      await assign(b.id, cc.id);
      const c = await submitted(cc, b.id);
      expect(c).toMatchObject({ status: 'submitted', businessId: b.id, mine: true, redacted: false });
      expect(await auditCount('data_correction_request.submitted', c.id)).toBe(1);
      const { rows } = await query<{ n: number }>(`SELECT count(*)::int AS n FROM outbox_events WHERE name = 'data_correction_request.submitted' AND aggregate_id = $1`, [c.id]);
      expect(rows[0].n).toBe(1);
      expect((await call(de, 'post', '/api/correction-requests', { businessId: b.id, issueType: 'Other', description: 'x' })).body.code).toBe('FORBIDDEN_ROLE');
      expect((await call(cc2, 'post', '/api/correction-requests', { businessId: b.id, issueType: 'Other', description: 'x' })).body.code).toBe('PERMISSION_DENIED');
      expect((await call(dv, 'post', '/api/correction-requests', { businessId: b.id, issueType: 'Other', description: 'x' })).body.code).toBe('PERMISSION_DENIED');
      const bad = await call(cc, 'post', '/api/correction-requests', { businessId: b.id, issueType: 'Nope', description: '' });
      expect(bad.status).toBe(400);
      const detail = await call(de, 'get', `/api/businesses/${b.id}`);
      expect(detail.body.flags).toContain('correction_requested');
      expect(detail.body.openCorrections).toBe(1);
      expect(detail.body.corrections[0]).toMatchObject({ id: c.id, status: 'submitted' });
    });

    it('queue scope: DE sees it, CC sees own only, DV sees nothing; IDOR on detail → 403 without data', async () => {
      const b = await created(de);
      await assign(b.id, cc.id);
      const c = await submitted(cc, b.id);
      const deList = await call(de, 'get', `/api/correction-requests?businessId=${b.id}&tab=open`);
      expect(deList.body.items.map((i: { id: string }) => i.id)).toEqual([c.id]);
      expect(deList.body.tabCounts.open).toBe(1);
      const ccList = await call(cc, 'get', '/api/correction-requests?tab=open&pageSize=100');
      expect(ccList.body.items.every((i: { requestedById: string }) => i.requestedById === cc.id)).toBe(true);
      const cc2List = await call(cc2, 'get', `/api/correction-requests?businessId=${b.id}`);
      expect(cc2List.body.total).toBe(0);
      expect((await call(dv, 'get', `/api/correction-requests?businessId=${b.id}`)).body.total).toBe(0);
      const idor = await call(cc2, 'get', `/api/correction-requests/${c.id}`);
      expect(idor.status).toBe(403);
      expectBareDenial(idor.body, 'PERMISSION_DENIED');
      expect((await call(owner, 'get', `/api/correction-requests/${c.id}`)).status).toBe(200);
      expect((await call(de, 'get', `/api/correction-requests/${randomUUID()}`)).status).toBe(404);
    });

    it('two reviewers start at once: the first wins, the second gets 409; release returns it to Submitted (AC-DFIX-003)', async () => {
      const b = await created(de);
      const c = await submitted(owner, b.id);
      const [r1, r2] = await Promise.all([
        call(de, 'post', `/api/correction-requests/${c.id}/start-review`, { version: c.version }),
        call(de2, 'post', `/api/correction-requests/${c.id}/start-review`, { version: c.version }),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      expect(await auditCount('data_correction_request.review_started', c.id)).toBe(1);
      const winner = r1.status === 200 ? de : de2;
      const loser = winner === de ? de2 : de;
      const won = r1.status === 200 ? r1.body : r2.body;
      expect(won).toMatchObject({ status: 'in_review', reviewerId: winner.id });
      expect((await call(loser, 'post', `/api/correction-requests/${c.id}/release`, { version: won.version })).status).toBe(409);
      const rel = await call(winner, 'post', `/api/correction-requests/${c.id}/release`, { version: won.version });
      expect(rel.status).toBe(200);
      expect(rel.body).toMatchObject({ status: 'submitted', reviewerId: null });
      expect(await auditCount('data_correction_request.released', c.id)).toBe(1);
    });

    it('resolve applies the business change and resolves in one save, with history linked to the request (AC-DFIX-004)', async () => {
      const b = await created(de);
      const c = await submitted(owner, b.id);
      const s = await call(de, 'post', `/api/correction-requests/${c.id}/start-review`, {});
      const p = phone();
      const res = await call(de, 'post', `/api/correction-requests/${c.id}/resolve`, { version: s.body.version, note: 'fixed', business: { version: b.version, phones: [p] } });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body).toMatchObject({ status: 'resolved', resolvedBy: expect.any(String), outcomeNote: 'fixed' });
      const biz = await call(de, 'get', `/api/businesses/${b.id}`);
      expect(biz.body.phones[0].normalized).toBe(`+961${p.number}`);
      const h = await call(de, 'get', `/api/businesses/${b.id}/history`);
      expect(h.body.items.find((i: { field: string }) => i.field === 'phones').correctionId).toBe(c.id);
      expect(await auditCount('data_correction_request.resolved', c.id)).toBe(1);
      expect((await query<{ n: number }>(`SELECT count(*)::int AS n FROM outbox_events WHERE name = 'data_correction_request.resolved' AND aggregate_id = $1`, [c.id])).rows[0].n).toBe(1); // BL-17
      const again = await call(de, 'post', `/api/correction-requests/${c.id}/reject`, { version: res.body.version, reason: 'no' });
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('STATE_CONFLICT');
    });

    it('PATCH /businesses/:id with correctionId resolves the request in the same transaction (FE3-REQ-3)', async () => {
      const b = await created(de);
      const c = await submitted(owner, b.id);
      await call(de, 'post', `/api/correction-requests/${c.id}/start-review`, {});
      const r = await call(de, 'patch', `/api/businesses/${b.id}`, { version: b.version, notes: 'corrected', correctionId: c.id, correctionNote: 'done' });
      expect(r.status).toBe(200);
      const after = await call(de, 'get', `/api/correction-requests/${c.id}`);
      expect(after.body).toMatchObject({ status: 'resolved', resolutionNote: 'done' });
      const other = await created(de);
      const c2 = await submitted(owner, other.id);
      await call(de, 'post', `/api/correction-requests/${c2.id}/start-review`, {});
      const mismatch = await call(de, 'patch', `/api/businesses/${b.id}`, { version: r.body.version, notes: 'x', correctionId: c2.id });
      expect(mismatch.status).toBe(409);
      expect((await call(de, 'get', `/api/businesses/${b.id}`)).body.version).toBe(r.body.version);
    });

    it('an apply that creates a duplicate phone is blocked and the request stays In review (AC-DUP-013)', async () => {
      const taken = await created(de);
      await ageBusiness(taken.id, 30);
      const b = await created(de);
      const c = await submitted(owner, b.id);
      const s = await call(de, 'post', `/api/correction-requests/${c.id}/start-review`, {});
      const res = await call(de, 'post', `/api/correction-requests/${c.id}/resolve`, {
        version: s.body.version,
        business: { version: b.version, phones: [{ countryCode: '+961', number: taken.phones[0].normalized.slice(4) }] },
      });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'DUPLICATE_BLOCKED', details: { visibility: 'hidden' } });
      expect((await call(de, 'get', `/api/correction-requests/${c.id}`)).body.status).toBe('in_review');
    });

    it('reject needs a reason, close needs a note; terminal states never reopen (AC-DFIX-005/007)', async () => {
      const b = await created(de);
      const c1 = await submitted(owner, b.id);
      const s1 = await call(de, 'post', `/api/correction-requests/${c1.id}/start-review`, {});
      expect((await call(de, 'post', `/api/correction-requests/${c1.id}/reject`, { version: s1.body.version, reason: '' })).status).toBe(400);
      const rj = await call(de, 'post', `/api/correction-requests/${c1.id}/reject`, { version: s1.body.version, reason: 'Not an error' });
      expect(rj.body.status).toBe('rejected');
      expect((await query<{ n: number }>(`SELECT count(*)::int AS n FROM outbox_events WHERE name = 'data_correction_request.rejected' AND aggregate_id = $1`, [c1.id])).rows[0].n).toBe(1); // BL-17
      for (const verb of ['start-review', 'withdraw']) {
        expect((await call(verb === 'withdraw' ? owner : de, 'post', `/api/correction-requests/${c1.id}/${verb}`, { version: rj.body.version })).status).toBe(409);
      }
      const c2 = await submitted(owner, b.id);
      const s2 = await call(de, 'post', `/api/correction-requests/${c2.id}/start-review`, {});
      expect((await call(de, 'post', `/api/correction-requests/${c2.id}/close-no-change`, { version: s2.body.version })).status).toBe(400);
      const cl = await call(de, 'post', `/api/correction-requests/${c2.id}/close-no-change`, { version: s2.body.version, note: 'Already right' });
      expect(cl.body.status).toBe('closed');
      expect((await query<{ n: number }>(`SELECT count(*)::int AS n FROM outbox_events WHERE name = 'data_correction_request.closed' AND aggregate_id = $1`, [c2.id])).rows[0].n).toBe(1); // BL-17
      const closedTab = await call(owner, 'get', `/api/correction-requests?businessId=${b.id}&tab=closed`);
      expect(closedTab.body.total).toBe(2);
      expect(closedTab.body.tabCounts).toMatchObject({ closed: 2, open: 0 });
    });

    it('withdraw: requester only, Submitted or In review; version checked (AC-DFIX-006)', async () => {
      const b = await created(de);
      await assign(b.id, cc.id);
      const c = await submitted(cc, b.id);
      expect((await call(cc2, 'post', `/api/correction-requests/${c.id}/withdraw`, { version: c.version })).body.code).toBe('PERMISSION_DENIED');
      const s = await call(de, 'post', `/api/correction-requests/${c.id}/start-review`, {});
      expect((await call(cc, 'post', `/api/correction-requests/${c.id}/withdraw`, { version: c.version })).body.code).toBe('VERSION_CONFLICT');
      const w = await call(cc, 'post', `/api/correction-requests/${c.id}/withdraw`, { version: s.body.version });
      expect(w.body.status).toBe('withdrawn');
      expect((await call(cc, 'get', '/api/correction-requests?tab=withdrawn&pageSize=100')).body.items.map((i: { id: string }) => i.id)).toContain(c.id);
    });

    it('row 6: a hidden business with an open request — DE reads it and may apply only that request (AC-VIS-013)', async () => {
      const b = await created(de);
      const c = await submitted(owner, b.id);
      await ageBusiness(b.id, 20);
      const read = await call(de2, 'get', `/api/businesses/${b.id}`);
      expect(read.status).toBe(200);
      expect(read.body).toMatchObject({ access: 'context_limited', exceptionRow: 'R6_OPEN_CORRECTION' });
      expect((await call(de2, 'get', `/api/search?q=${encodeURIComponent(b.name)}`)).body.total).toBe(0); // never in search
      expect((await call(de2, 'get', `/api/businesses?q=${encodeURIComponent(b.name)}`)).body.total).toBe(0); // nor the directory
      const plain = await call(de2, 'patch', `/api/businesses/${b.id}`, { version: b.version, notes: 'x' });
      expect(plain.body.code).toBe('HIDDEN_BY_POLICY');
      const s = await call(de2, 'post', `/api/correction-requests/${c.id}/start-review`, {});
      expect(s.status).toBe(200);
      const res = await call(de2, 'post', `/api/correction-requests/${c.id}/resolve`, { version: s.body.version, business: { version: b.version, notes: 'fixed via queue' } });
      expect(res.status).toBe(200);
      // Terminal now: row 6 ends, the business is hidden again and the resolved row leaves the DE queue.
      expect((await call(de2, 'get', `/api/businesses/${b.id}`)).body.code).toBe('HIDDEN_BY_POLICY');
      const q = await call(de2, 'get', `/api/correction-requests?businessId=${b.id}`);
      expect(q.body.total).toBe(0);
      expect(q.body.tabCounts.resolved).toBe(0);
    });

    // Changed expectation (approved D9): the requester keeps context access WHILE the request is open (was:
    // redacted as soon as the assignment ended). Once it is no longer open, OI-09 redaction applies again.
    it('D9: the requester keeps context access while the request is open; redacted once it is withdrawn (OI-09)', async () => {
      const b = await created(de);
      await assign(b.id, cc.id);
      const c = await submitted(cc, b.id);
      await unassign(b.id);
      const d = await call(cc, 'get', `/api/correction-requests/${c.id}`);
      expect(d.status).toBe(200);
      expect(d.body).toMatchObject({ redacted: false, businessId: b.id, status: 'submitted' });
      const biz = await call(cc, 'get', `/api/businesses/${b.id}`);
      expect(biz.status).toBe(200);
      expect(biz.body).toMatchObject({ access: 'context_limited', exceptionRow: 'R6_OPEN_CORRECTION' });
      // Context only: not in the directory or search.
      expect((await call(cc, 'get', `/api/businesses?q=${encodeURIComponent(b.name)}`)).body.total).toBe(0);
      const w = await call(cc, 'post', `/api/correction-requests/${c.id}/withdraw`, { version: d.body.version });
      expect(w.status).toBe(200);
      expect((await call(cc, 'get', `/api/businesses/${b.id}`)).status).toBe(403);
      const after = await call(cc, 'get', `/api/correction-requests/${c.id}`);
      expect(after.body).toMatchObject({ redacted: true, businessId: null, businessName: null, status: 'withdrawn' });
      const list = await call(cc, 'get', '/api/correction-requests?tab=withdrawn&pageSize=100');
      expect(list.body.items.find((i: { id: string }) => i.id === c.id)).toMatchObject({ redacted: true, businessId: null });
    });

    it('N-4: a deactivated reviewer\'s In-review requests return to Submitted (AC-DFIX-008)', async () => {
      const reviewer = await agentFor('data_entry');
      const b = await created(de);
      const c = await submitted(owner, b.id);
      await call(reviewer, 'post', `/api/correction-requests/${c.id}/start-review`, {});
      const n = await runSystemCommand('test.release', (ctx) => releaseForDeactivatedReviewer(ctx, reviewer.id));
      expect(n).toBe(1);
      const after = await call(owner, 'get', `/api/correction-requests/${c.id}`);
      expect(after.body).toMatchObject({ status: 'submitted', reviewerId: null });
    });
  });

  // -------------------------------------------------------------------------------------------
  describe('engine details', () => {
    it('checkMany groups mixed resource types (security review R9)', async () => {
      const b = await created(de);
      const m = await access.checkMany(pool, { employeeId: de.id, role: 'data_entry', sessionState: 'active' }, 'business.read', [
        { type: 'business', id: b.id },
        { type: 'duplicate_preview', id: b.id },
        { type: 'deal', id: randomUUID() },
      ]);
      expect(m.size).toBe(2); // the business id resolves to one entry; the unresolved deal is denied
      expect(m.get(b.id)).toEqual({ allowed: true, level: 'full' });
    });
  });

  // -------------------------------------------------------------------------------------------
  describe('approved v1 policy (2026-10-29): D11 phones, D20 restore and archiving', () => {
    async function submitted2(by: Agent, businessId: string) {
      const r = await call(by, 'post', '/api/correction-requests', { businessId, issueType: 'Incorrect phone', description: 'The number rings a different shop' });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      return r.body as { id: string; version: number };
    }

    it('D11: an explicit, valid E.164 country code is required: +000 / 0961 / letters are refused, never normalised', async () => {
      for (const countryCode of ['+000', '0961', '+0', 'abc', '+12345']) {
        const res = await createBiz(de, { phones: [{ countryCode, number: `7${rnd7()}` }] });
        expect(res.status, countryCode).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(Object.keys(res.body.details)).toContain('phones.0.number');
      }
      const intlZero = await createBiz(de, { phones: [{ countryCode: '', number: `+0${rnd7()}12` }] });
      expect(intlZero.status).toBe(400);
      // No default country code is configured (company input still required): a bare national number is not
      // normalised with an assumed code.
      const bare = await createBiz(de, { phones: [{ countryCode: '', number: `7${rnd7()}` }] });
      expect(bare.status).toBe(409);
      expect(bare.body.code).toBe('POLICY_NOT_CONFIGURED');
      const ok = await createBiz(de, { phones: [{ countryCode: '+961', number: `07${rnd7()}` }] });
      expect(ok.status).toBe(201);
      expect(ok.body.phones[0].normalized).toMatch(/^\+9617\d{7}$/);
    });

    it('D20: restore re-validates the category (inactive → 422 CATEGORY_INACTIVE)', async () => {
      const cat = await call(owner, 'post', '/api/categories', { name: `${uniq()} Florist` });
      expect(cat.status).toBe(201);
      const b = await created(de, { category: undefined, categoryId: cat.body.id });
      const arch = await call(owner, 'post', `/api/businesses/${b.id}/archive`, { version: b.version });
      expect(arch.status).toBe(200);
      expect((await call(owner, 'post', `/api/categories/${cat.body.id}/deactivate`, { version: cat.body.version })).status).toBe(200);
      const res = await call(owner, 'post', `/api/businesses/${b.id}/restore`, { version: arch.body.version });
      expect(res.status).toBe(422);
      expect(res.body.details).toMatchObject({ reason: 'CATEGORY_INACTIVE' });
      expect(res.body.error).toMatch(/Choose an active category/);
      expect((await call(owner, 'get', `/api/businesses/${b.id}`)).body.archived).toBe(true);
      // Owner decision 2026-10-29 "Pick a new category": the inactive one is refused as the replacement too…
      const stillInactive = await call(owner, 'post', `/api/businesses/${b.id}/restore`, { version: arch.body.version, categoryId: cat.body.id });
      expect(stillInactive.status).toBe(400);
      expect(Object.keys(stillInactive.body.details)).toContain('categoryId');
      // …an active one is applied in the same transaction, with history + audit, then the business is restored.
      const other = (await call(owner, 'get', '/api/categories?pageSize=100')).body.items.find((i: { system: boolean }) => i.system);
      const ok = await call(owner, 'post', `/api/businesses/${b.id}/restore`, { version: arch.body.version, categoryId: other.id });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body).toMatchObject({ archived: false, categoryId: other.id, category: 'Other' });
      const { rows: hist } = await query<{ field: string; before_value: unknown; after_value: unknown }>(
        `SELECT field, before_value, after_value FROM business_edit_history WHERE business_id = $1 AND change_kind = 'updated' AND field = 'category'`,
        [b.id]
      );
      expect(hist).toEqual([{ field: 'category', before_value: cat.body.name, after_value: 'Other' }]);
      const { rows: au } = await query<{ reason: string }>(
        `SELECT reason FROM audit_events WHERE event_name = 'business.updated' AND entity_id = $1`,
        [b.id]
      );
      expect(au.map((r) => r.reason)).toContain('category inactive at restore');
      expect(await auditCount('business.restored', b.id)).toBe(1);
    });

    it('restore with an active category refuses a categoryId change (edit after restoring instead); a failed restore changes nothing', async () => {
      const b = await created(de);
      const arch = await call(owner, 'post', `/api/businesses/${b.id}/archive`, { version: b.version });
      const cat = await call(owner, 'post', '/api/categories', { name: `${uniq()} Spa` });
      const res = await call(owner, 'post', `/api/businesses/${b.id}/restore`, { version: arch.body.version, categoryId: cat.body.id });
      expect(res.status).toBe(400);
      expect((await call(owner, 'get', `/api/businesses/${b.id}`)).body).toMatchObject({ archived: true, category: 'Other' });
    });

    it('D20: restore re-runs the duplicate check (a colliding name blocks the restore; nothing is changed)', async () => {
      const base = `${uniq()} Restore Bakery`;
      const a = await created(de, { name: `${base} old` });
      const arch = await call(owner, 'post', `/api/businesses/${a.id}/archive`, { version: a.version });
      expect(arch.status).toBe(200);
      const b = await created(de, { name: base });
      // A legacy row (no stored key) that normalises to the same name + branch as the live record.
      const { rows } = await query<{ normalized_name: string; normalized_branch: string }>('SELECT normalized_name, normalized_branch FROM businesses WHERE id = $1', [b.id]);
      await query('UPDATE businesses SET name_key = NULL, normalized_name = $2, normalized_branch = $3 WHERE id = $1', [a.id, rows[0].normalized_name, rows[0].normalized_branch]);
      const res = await call(owner, 'post', `/api/businesses/${a.id}/restore`, { version: arch.body.version });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_BLOCKED');
      expect(res.body.details).toMatchObject({ visibility: 'visible', id: b.id, matchedOn: 'name' });
      expect((await call(owner, 'get', `/api/businesses/${a.id}`)).body.archived).toBe(true);
      // A clean archived record restores.
      const c = await created(de);
      const ca = await call(owner, 'post', `/api/businesses/${c.id}/archive`, { version: c.version });
      expect((await call(owner, 'post', `/api/businesses/${c.id}/restore`, { version: ca.body.version })).status).toBe(200);
    });

    it('D9/D20: archiving removes access everywhere for non-Owners, even for an open correction requester', async () => {
      const b = await created(de);
      await assign(b.id, cc.id);
      const c = await submitted2(cc, b.id);
      expect((await call(cc, 'get', `/api/businesses/${b.id}`)).status).toBe(200);
      const v = await call(owner, 'get', `/api/businesses/${b.id}`);
      expect((await call(owner, 'post', `/api/businesses/${b.id}/archive`, { version: v.body.version })).status).toBe(200);
      for (const a of [cc, de]) expect((await call(a, 'get', `/api/businesses/${b.id}`)).status, a.role).toBe(404);
      const req = await call(cc, 'get', `/api/correction-requests/${c.id}`);
      expect(req.body).toMatchObject({ redacted: true, businessId: null });
      expect((await call(de, 'get', `/api/correction-requests?businessId=${b.id}`)).body.total).toBe(0);
      await unassign(b.id);
    });
  });
});
