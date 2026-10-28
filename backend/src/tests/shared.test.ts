import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { DEMO_LABEL, POLICY_FLAGS, describeFlags, loadPolicyFlags } from '../shared/flags.js';
import { PageQuerySchema, orderByClause, pageClause, toPage } from '../shared/pagination.js';
import { SqlParams } from '../shared/sql.js';
import { access, assertAllowed, can, defineActions, requireAction } from '../shared/access.js';
import { HttpError, versionConflict } from '../shared/errors.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { modules } from '../modules/index.js';
import app from '../app.js';

describe('shared/flags (policy registry)', () => {
  it('loads every working default from an empty env', () => {
    const f = loadPolicyFlags({});
    expect(f['visibility.timerBasis']).toBe('creation');
    expect(f['deals.closureMode']).toBe('ownerVerify');
    expect(f['reservation.leaseSeconds']).toBe(300);
    expect(f['notifications.emailRetrySeconds']).toEqual([60, 600, 3600]);
    expect(f['company.timezone']).toBe('');
  });

  it('labels every flag as a demonstration alternative and flags NEEDS VALUE items as not configured', () => {
    for (const def of Object.values(POLICY_FLAGS)) expect(def.label).toBe(DEMO_LABEL);
    const tz = describeFlags(loadPolicyFlags({})).find((r) => r.key === 'company.timezone');
    expect(tz?.configured).toBe(false);
  });

  it('reads env overrides and rejects invalid values', () => {
    expect(loadPolicyFlags({ POLICY_DEALS_CLOSURE_MODE: 'direct' })['deals.closureMode']).toBe('direct');
    expect(() => loadPolicyFlags({ POLICY_DEALS_CLOSURE_MODE: 'nope' })).toThrow();
    expect(() => loadPolicyFlags({ POLICY_RESERVATION_LEASE_SECONDS: '5' })).toThrow();
  });
});

describe('shared/pagination + sql', () => {
  it('builds whitelisted ORDER BY and parameterised LIMIT/OFFSET', () => {
    const q = PageQuerySchema.parse({ page: '3', pageSize: '10', sort: 'name; DROP TABLE x', order: 'asc' });
    expect(orderByClause(q, { createdAt: 'b.created_at', name: 'b.name' }, 'createdAt')).toBe('ORDER BY b.created_at ASC');
    const p = new SqlParams();
    p.add('x');
    expect(pageClause(q, p)).toBe('LIMIT $2 OFFSET $3');
    expect(p.values).toEqual(['x', 10, 20]);
    expect(toPage([], 0, q)).toEqual({ items: [], page: 3, pageSize: 10, total: 0 });
  });

  it('caps pageSize at 100', () => {
    expect(() => PageQuerySchema.parse({ pageSize: '500' })).toThrow(ZodError);
  });
});

describe('shared/access (contract, fail closed)', () => {
  defineActions({ 'report.test_view': { roles: ['owner', 'developer'] }, 'report.test_admin': { roles: ['owner'], admin: true } });
  const dev = { employeeId: 'e1', role: 'developer' as const, sessionState: 'active' as const };
  const pendingOwner = { employeeId: 'o1', role: 'owner' as const, sessionState: 'pending_2fa_verification' as const };

  it('rejects duplicate action declarations', () => {
    expect(() => defineActions({ 'report.test_view': { roles: ['owner'] } })).toThrow();
  });

  it('role capability honours roles and Owner 2FA', () => {
    expect(can(dev, 'report.test_view')).toBe(true);
    expect(can(dev, 'report.test_admin')).toBe(false);
    expect(can(pendingOwner, 'report.test_admin')).toBe(false);
    expect(can(dev, 'report.undeclared')).toBe(false);
  });

  it('default engine denies every resource and scopes lists to FALSE', async () => {
    const decision = await access.check({ query: async () => ({ rows: [] }) } as never, dev, 'report.test_view', { type: 'report', id: 'r' });
    expect(decision).toEqual({ allowed: false, reason: 'permission_denied' });
    expect(access.scopeFilter(dev, 'report.test_view', 'report', { alias: 'r', params: new SqlParams() })).toBe('FALSE');
    expect(() => assertAllowed(decision)).toThrow(HttpError);
  });

  it('requireAction middleware maps to 401/403 codes', async () => {
    const mini = express();
    mini.use((req, _res, next) => {
      const role = req.header('x-role');
      if (role) req.user = { id: 'u', email: '', fullName: '', role: role as never, isPending2FA: false, sessionId: 's', sessionState: (req.header('x-state') as never) || 'active', csrfToken: '' };
      next();
    });
    mini.get('/v', requireAction('report.test_view'), (_req, res) => res.json({ ok: true }));
    mini.get('/a', requireAction('report.test_admin'), (_req, res) => res.json({ ok: true }));
    mini.get('/u', requireAction('report.undeclared'), (_req, res) => res.json({ ok: true }));
    expect((await request(mini).get('/v')).status).toBe(401);
    expect((await request(mini).get('/v').set('x-role', 'developer')).status).toBe(200);
    expect((await request(mini).get('/v').set('x-role', 'call_center')).body.code).toBe('FORBIDDEN_ROLE');
    expect((await request(mini).get('/a').set('x-role', 'owner').set('x-state', 'pending_2fa_verification')).body.code).toBe('OWNER_2FA_REQUIRED');
    expect((await request(mini).get('/u').set('x-role', 'owner')).status).toBe(403);
  });
});

describe('shared/errors + errorHandler', () => {
  it('renders HttpError with the shared shape', async () => {
    const mini = express();
    mini.get('/c', () => {
      throw versionConflict(7);
    });
    mini.use(errorHandler);
    const res = await request(mini).get('/c');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'VERSION_CONFLICT', details: { currentVersion: 7 } });
  });
});

describe('module registry', () => {
  it('has unique names and mount paths, and keeps the Increment 1 mounts', () => {
    const names = modules.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    const paths = modules.flatMap((m) => m.mounts.map((x) => x.path));
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('/api/auth');
    expect(paths).toContain('/api/employees');
  });

  it('answers unknown API paths with the JSON error shape and no-store', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
