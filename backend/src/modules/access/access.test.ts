/**
 * MOD-access unit tests (no DB). Owner: BE2.
 *  - VT-3 harness: every authz-matrix row × every role through `requireAction`.
 *  - Engine decision paths over scripted fact rows (FakeDb), both branches of every FLAG it reads.
 *  - scopeFilter text generation and fail-closed defaults.
 * SQL semantics (timer, rows, timezone) are covered by access.api.test.ts on the Docker test DB.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { Request, Response } from 'express';
import type { Role } from '../../middleware/auth.js';
import {
  can,
  requireAction,
  getActionPolicy,
  isSystemRole,
  registerDynamicRoleChecker,
  CUSTOM_ROLES_ENABLED,
  dynamicGrantFor,
  type Action,
  type DataScope,
  type Principal,
} from '../../shared/access.js';
import { grantRefusal } from './matrix.js';
import { DynamicRoleCache } from './dynamicService.js';
import { loadPolicyFlags } from '../../shared/flags.js';
import { SqlParams } from '../../shared/sql.js';
import { FakeDb } from '../../tests/helpers/fakeDb.js';
import { AUTHZ_MATRIX, defineMatrixActions, driftFor, matrixPolicy, verifyDeclaredActions } from './matrix.js';
import { createAccessEngine, registerResourceResolver, duplicateRevelation } from './service.js';
import { buildRuleFragments, combinedPredicate, type RuleFlags } from './rules.js';

const ROLES: Role[] = ['owner', 'data_entry', 'call_center', 'developer'];
const U = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const B2 = '33333333-3333-4333-8333-333333333333';

const baseFlags = (over: Partial<RuleFlags> = {}): RuleFlags => ({ ...loadPolicyFlags({}), ...over });
const principal = (role: Role, sessionState: Principal['sessionState'] = 'active'): Principal => ({
  employeeId: U,
  role,
  sessionState,
});

interface Captured {
  status?: number;
  body?: { code?: string };
  nexted: boolean;
}
function runMiddleware(action: string, role: Role, sessionState: Principal['sessionState'] = 'active'): Captured {
  const out: Captured = { nexted: false };
  const req = { user: { id: U, role, sessionState, sessionId: 's' }, requestId: 'r' } as unknown as Request;
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: { code?: string }) {
      out.body = body;
      return this;
    },
  } as unknown as Response;
  requireAction(action as Action)(req, res, () => {
    out.nexted = true;
  });
  return out;
}

type FactRow = {
  business_id: string;
  in_scope?: boolean;
  related?: boolean;
  in_window?: boolean;
  r1?: boolean;
  r2?: boolean;
  r3?: boolean;
  r4?: boolean;
  r5?: boolean;
  r6?: boolean;
};
function dbWith(rows: FactRow[]): FakeDb {
  const full = rows.map((r) => ({
    in_scope: true,
    related: true,
    in_window: true,
    r1: false,
    r2: false,
    r3: false,
    r4: false,
    r5: false,
    r6: false,
    ...r,
  }));
  return new FakeDb().on(/FROM access_facts af/, full);
}
const engine = (over: Partial<RuleFlags> = {}) =>
  createAccessEngine({ now: () => new Date('2026-10-23T12:00:00Z'), flags: () => baseFlags(over) });

describe('VT-3 harness: authz matrix × role through requireAction', () => {
  beforeAll(() => {
    // Modules imported transitively (e.g. admin via service.ts) already declared some rows from the matrix.
    defineMatrixActions(Object.keys(AUTHZ_MATRIX).filter((a) => !getActionPolicy(a as Action)));
  });

  for (const [action, row] of Object.entries(AUTHZ_MATRIX)) {
    for (const role of ROLES) {
      const allowed = row.roles.includes(role);
      it(`${action} × ${role} → ${allowed ? 'allowed' : '403 FORBIDDEN_ROLE'}`, () => {
        const r = runMiddleware(action, role);
        if (allowed) {
          expect(r.nexted).toBe(true);
        } else {
          expect(r.nexted).toBe(false);
          expect(r.status).toBe(403);
          expect(r.body?.code).toBe('FORBIDDEN_ROLE');
        }
      });
    }
  }

  it('Owner-only / admin actions need completed 2FA (pending → OWNER_2FA_REQUIRED)', () => {
    const adminActions = Object.entries(AUTHZ_MATRIX).filter(([, r]) => r.admin).map(([a]) => a);
    expect(adminActions.length).toBeGreaterThan(20);
    for (const a of adminActions) {
      for (const state of ['pending_2fa_enrollment', 'pending_2fa_verification'] as const) {
        const r = runMiddleware(a, 'owner', state);
        expect(r.nexted).toBe(false);
        expect(r.body?.code).toBe('OWNER_2FA_REQUIRED');
      }
    }
  });

  it('nobody-rows (business.delete, audit.export/update/delete) deny every role', () => {
    for (const a of ['business.delete', 'audit.export', 'audit.update', 'audit.delete']) {
      expect(AUTHZ_MATRIX[a].roles).toEqual([]);
      for (const role of ROLES) expect(runMiddleware(a, role).nexted).toBe(false);
    }
  });

  it('undeclared action is denied (fail closed)', () => {
    const r = runMiddleware('business.nope', 'owner');
    expect(r.status).toBe(403);
    expect(r.body?.code).toBe('FORBIDDEN_ROLE');
  });

  it('declarations equal the matrix; drift is detected', () => {
    expect(verifyDeclaredActions(Object.keys(AUTHZ_MATRIX))).toEqual([]);
    expect(getActionPolicy('business.archive' as Action)?.admin).toBe(true);
    expect(() => matrixPolicy('not.in.matrix')).toThrow(/not in docs\/security\/authz-matrix/);
    expect(driftFor('never.declared')).toBeUndefined();
  });
});

describe('engine decisions (steps 5–10) over scripted facts', () => {
  it('Owner: level owner; ownerViewedHidden only when hidden for others and the OI-05 setting is on', async () => {
    const e = engine();
    const visible = await e.check(dbWith([{ business_id: B, in_window: true }]), principal('owner'), 'business.read', { type: 'business', id: B });
    expect(visible).toEqual({ allowed: true, level: 'owner' });
    const hidden = await e.check(dbWith([{ business_id: B, in_window: false }]), principal('owner'), 'business.read', { type: 'business', id: B });
    expect(hidden).toEqual({ allowed: true, level: 'owner', ownerViewedHidden: true });
    const off = engine({ 'access.auditOwnerHiddenReads': false });
    const silent = await off.check(dbWith([{ business_id: B, in_window: false }]), principal('owner'), 'business.read', { type: 'business', id: B });
    expect(silent).toEqual({ allowed: true, level: 'owner' });
  });

  it('Owner pending 2FA: R11-a denies without touching the DB; R11-b evaluates as Owner', async () => {
    const db = dbWith([{ business_id: B }]);
    const a = await engine({ 'auth.ownerPending2faScope': 'R11-a' }).check(db, principal('owner', 'pending_2fa_verification'), 'business.read', { type: 'business', id: B });
    expect(a).toEqual({ allowed: false, reason: 'permission_denied' });
    expect(db.calls).toHaveLength(0);
    const b = await engine({ 'auth.ownerPending2faScope': 'R11-b' }).check(db, principal('owner', 'pending_2fa_verification'), 'business.read', { type: 'business', id: B });
    expect(b).toEqual({ allowed: true, level: 'owner' });
    expect(engine({ 'auth.ownerPending2faScope': 'R11-a' }).scopeFilter(principal('owner', 'pending_2fa_enrollment'), 'business.list', 'business', { alias: 'b', params: new SqlParams() })).toBe('FALSE');
    expect(engine({ 'auth.ownerPending2faScope': 'R11-b' }).scopeFilter(principal('owner', 'pending_2fa_enrollment'), 'business.list', 'business', { alias: 'b', params: new SqlParams() })).toBe('TRUE');
  });

  it('non-Owner: not_found / permission_denied / full / context_limited / hidden_by_policy, in VT-1 order', async () => {
    const e = engine();
    const cc = principal('call_center');
    const ref = { type: 'business' as const, id: B };
    expect(await e.check(dbWith([]), cc, 'business.read', ref)).toEqual({ allowed: false, reason: 'not_found' });
    expect(await e.check(dbWith([{ business_id: B, related: false, in_window: true, r5: true }]), cc, 'business.read', ref)).toEqual({ allowed: false, reason: 'permission_denied' });
    expect(await e.check(dbWith([{ business_id: B, in_scope: false }]), cc, 'business.read', ref)).toEqual({ allowed: false, reason: 'permission_denied' });
    expect(await e.check(dbWith([{ business_id: B, in_window: true, r1: true }]), cc, 'business.read', ref)).toEqual({ allowed: true, level: 'full' });
    expect(await e.check(dbWith([{ business_id: B, in_window: false, r5: true }]), cc, 'business.read', ref)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R5_SCHEDULED_CALLBACK' });
    expect(await e.check(dbWith([{ business_id: B, in_window: false, r1: true, r5: true }]), cc, 'business.read', ref)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R1_ACCEPTED_OPPORTUNITY' });
    expect(await e.check(dbWith([{ business_id: B, in_window: false }]), cc, 'business.read', ref)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
  });

  it('a non-UUID id is not_found without a query; a type without a resolver is permission_denied (fail closed)', async () => {
    const db = dbWith([{ business_id: B }]);
    expect(await engine().check(db, principal('data_entry'), 'business.read', { type: 'business', id: 'abc' })).toEqual({ allowed: false, reason: 'not_found' });
    expect(await engine().check(db, principal('data_entry'), 'follow_up.read', { type: 'follow_up', id: B })).toEqual({ allowed: false, reason: 'permission_denied' });
    expect(db.calls).toHaveLength(0);
  });

  it('checkMany: one query for all business ids, per-ref decisions, bad ids not_found', async () => {
    const db = dbWith([{ business_id: B }, { business_id: B2, in_window: false }]);
    const m = await engine().checkMany(db, principal('data_entry'), 'business.read', [
      { type: 'business', id: B },
      { type: 'business', id: B2 },
      { type: 'business', id: 'nope' },
    ]);
    expect(db.find(/FROM access_facts/)).toHaveLength(1);
    expect(m.get(B)).toEqual({ allowed: true, level: 'full' });
    expect(m.get(B2)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    expect(m.get('nope')).toEqual({ allowed: false, reason: 'not_found' });
    expect(await engine().checkMany(db, principal('owner'), 'business.read', [])).toEqual(new Map());
  });

  it('registered resolvers: business-related type resolves to its business; own-record types use owner ids', async () => {
    registerResourceResolver('follow_up', async (_db, id) => (id === B ? { kind: 'business', businessId: B2 } : null));
    registerResourceResolver('attendance_session', async (_db, id) => (id === B ? { kind: 'own', ownerIds: [U] } : { kind: 'own', ownerIds: [] }));
    const db = dbWith([{ business_id: B2, in_window: false, r5: true }]);
    expect(await engine().check(db, principal('call_center'), 'follow_up.read', { type: 'follow_up', id: B })).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R5_SCHEDULED_CALLBACK' });
    expect(await engine().check(db, principal('call_center'), 'follow_up.read', { type: 'follow_up', id: B2 })).toEqual({ allowed: false, reason: 'not_found' });
    expect(await engine().check(db, principal('developer'), 'attendance.read' as Action, { type: 'attendance_session', id: B })).toEqual({ allowed: true, level: 'full' });
    expect(await engine().check(db, principal('developer'), 'attendance.read' as Action, { type: 'attendance_session', id: B2 })).toEqual({ allowed: false, reason: 'permission_denied' });
    expect(await engine().check(db, principal('owner'), 'attendance.read' as Action, { type: 'attendance_session', id: B2 })).toEqual({ allowed: true, level: 'owner' });
    expect(await engine().check(db, principal('developer'), 'category.list', { type: 'category', id: B })).toEqual({ allowed: true, level: 'full' });
    expect(await engine().check(db, principal('call_center'), 'profile.read' as Action, { type: 'employee', id: U })).toEqual({ allowed: true, level: 'full' });
    expect(await engine().check(db, principal('call_center'), 'profile.read' as Action, { type: 'employee', id: B })).toEqual({ allowed: false, reason: 'permission_denied' });
  });

  it('duplicate preview: an unreadable match reveals existence only (DEC-003 i)', async () => {
    const hidden = await engine().check(dbWith([{ business_id: B, in_window: false }]), principal('data_entry'), 'business.duplicate_check', { type: 'duplicate_preview', id: B });
    expect(duplicateRevelation(hidden)).toBe('existence_only');
    expect(hidden).not.toHaveProperty('level');
    const owner = await engine().check(dbWith([{ business_id: B, in_window: false }]), principal('owner'), 'business.duplicate_check', { type: 'duplicate_preview', id: B });
    expect(duplicateRevelation(owner)).toBe('full');
  });
});

describe('scopeFilter generation', () => {
  it('Owner TRUE; business types → EXISTS over access_facts; related types default to business_id', () => {
    const e = engine();
    expect(e.scopeFilter(principal('owner'), 'business.list', 'business', { alias: 'b', params: new SqlParams() })).toBe('TRUE');
    const p = new SqlParams();
    const sql = e.scopeFilter(principal('call_center'), 'business.list', 'business', { alias: 'b', params: p });
    expect(sql).toMatch(/^EXISTS \(SELECT 1 FROM access_facts af WHERE af\.business_id = b\.id AND /);
    expect(p.values).toContain(U);
    const q = new SqlParams();
    expect(e.scopeFilter(principal('call_center'), 'follow_up.read', 'follow_up', { alias: 'f', params: q })).toContain('af.business_id = f.business_id');
    expect(e.scopeFilter(principal('call_center'), 'meeting.read', 'meeting', { alias: 'd', params: q, idColumn: 'biz' })).toContain('af.business_id = d.biz');
  });

  it('non-business types: role-level TRUE, own-column match, Owner-only types FALSE, unknown FALSE', () => {
    const e = engine();
    const p = new SqlParams();
    expect(e.scopeFilter(principal('developer'), 'category.list', 'category', { alias: 'c', params: p })).toBe('TRUE');
    expect(e.scopeFilter(principal('developer'), 'attendance.read' as Action, 'attendance_session', { alias: 's', params: p })).toBe('s.employee_id = $1');
    expect(e.scopeFilter(principal('developer'), 'notification.list', 'notification', { alias: 'n', params: p })).toBe('n.recipient_id = $2');
    expect(e.scopeFilter(principal('developer'), 'notification.list', 'notification', { alias: 'n', params: p, idColumn: 'to_employee' })).toBe('n.to_employee = $3');
    expect(e.scopeFilter(principal('developer'), 'employee.list', 'audit_event', { alias: 'a', params: p })).toBe('FALSE');
    expect(e.scopeFilter(principal('developer'), 'report.read', 'report', { alias: 'r', params: p })).toBe('FALSE');
  });

  it('rejects non-identifier alias/idColumn (no SQL injection through options)', () => {
    const e = engine();
    expect(() => e.scopeFilter(principal('developer'), 'business.list', 'business', { alias: 'b; DROP', params: new SqlParams() })).toThrow();
    expect(() => e.scopeFilter(principal('developer'), 'business.list', 'business', { alias: 'b', idColumn: '1=1 OR', params: new SqlParams() })).toThrow();
  });
});

describe('rule table: both branches of every FLAG it reads', () => {
  const frag = (role: Role, action: Action, over: Partial<RuleFlags> = {}) => {
    const params = new SqlParams();
    const fr = buildRuleFragments({ role, employeeId: U, action, resourceType: 'business', now: new Date(), flags: baseFlags(over), params });
    return { fr, params, sql: combinedPredicate(fr) };
  };

  // Changed expectation (approved D9): the DEC-001 `inactivity` basis is retired. The window is 15 ELAPSED days
  // (no calendar boundary, no touchpoint reset) and the flag refuses `inactivity` at load.
  it('D9: Data Entry window = created_at + 15 elapsed days; never the last touchpoint; `inactivity` rejected at flag load', () => {
    const de = frag('data_entry', 'business.read');
    expect(de.fr.window.replace(/\$\d+/g, '$n')).toBe('(af.created_at + make_interval(days => 15) > $n::timestamptz)');
    expect(de.fr.window).not.toContain('last_touchpoint_at');
    expect(de.fr.window).not.toContain('timezone(');
    expect(() => loadPolicyFlags({ POLICY_VISIBILITY_TIMER_BASIS: 'inactivity' })).toThrow(/POLICY_VISIBILITY_TIMER_BASIS/);
    expect(loadPolicyFlags({ POLICY_VISIBILITY_TIMER_BASIS: 'creation' })['visibility.timerBasis']).toBe('creation');
  });

  it('D9: Call Center window = current assignment start + 15 elapsed days, for the current assignee only', () => {
    const cc = frag('call_center', 'business.read');
    expect(cc.fr.window.replace(/\$\d+/g, '$n')).toBe('(af.assignee_id = $n::uuid AND (af.assignment_started_at + make_interval(days => 15) > $n::timestamptz))');
    expect(cc.fr.window).not.toContain('af.created_at');
    expect(cc.fr.relation).toBe('(af.assignee_id = $1::uuid OR ($1::uuid = ANY(af.open_correction_requester_ids)))');
  });

  it('OI-02 access.dataEntryScope: DE-1 any business; DE-2 own-created plus correction queue', () => {
    expect(frag('data_entry', 'business.read', { 'access.dataEntryScope': 'DE-1' }).fr.scope).toBe('TRUE');
    expect(frag('data_entry', 'business.read', { 'access.dataEntryScope': 'DE-2' }).fr.scope).toContain('af.created_by = $1::uuid OR af.has_open_correction');
  });

  // Changed expectation (approved D15): Call Center never holds row 1 (accepted opportunities).
  it('DEC-005 / D15: row 1 = the assigned Developer only (flag `assigned`); never Call Center', () => {
    expect(frag('developer', 'deal.read', { 'deals.developerPreClosure': 'assigned' }).fr.rows.R1_ACCEPTED_OPPORTUNITY).toContain('ANY(af.deal_developer_ids)');
    expect(frag('developer', 'deal.read', { 'deals.developerPreClosure': 'closedOnly' }).fr.rows.R1_ACCEPTED_OPPORTUNITY).toBe('FALSE');
    for (const v of ['assigned', 'closedOnly'] as const) {
      expect(frag('call_center', 'deal.read', { 'deals.developerPreClosure': v }).fr.rows.R1_ACCEPTED_OPPORTUNITY).toBe('FALSE');
    }
  });

  it('D9: row 5 (callback + 48 h) requires the CURRENT assignment as well as the responsibility', () => {
    const r5 = frag('call_center', 'business.read').fr.rows.R5_SCHEDULED_CALLBACK;
    expect(r5).toContain('af.assignee_id = $1::uuid AND af.open_follow_up_responsible_id = $1::uuid');
  });

  it('D9/D15: row 2 needs a project that is active (not completed/cancelled) or completed < 15 days ago', () => {
    const r2 = frag('developer', 'business.read').fr.rows.R2_CLOSED_DEAL;
    expect(r2).toContain("af.deal_stage = 'closed'");
    expect(r2).toContain('af.project_id IS NOT NULL');
    expect(r2).toContain("NOT IN ('completed', 'cancelled')");
    expect(frag('developer', 'business.read').fr.rows.R3_ACTIVE_PROJECT).toContain("NOT IN ('completed', 'cancelled')");
  });

  it('D9: row 6 = requester of an open correction for every matrix role (Data Entry also as reviewer); never the Owner', () => {
    expect(frag('data_entry', 'business.read').fr.rows.R6_OPEN_CORRECTION).toBe('(af.has_open_correction OR $1::uuid = ANY(af.open_correction_requester_ids))');
    expect(frag('call_center', 'business.read').fr.rows.R6_OPEN_CORRECTION).toBe('($1::uuid = ANY(af.open_correction_requester_ids))');
    expect(frag('developer', 'business.read').fr.rows.R6_OPEN_CORRECTION).toBe('($1::uuid = ANY(af.open_correction_requester_ids))');
    expect(frag('developer', 'business.read').fr.relation).toContain('ANY(af.open_correction_requester_ids)');
    expect(frag('owner', 'business.read').fr.rows.R6_OPEN_CORRECTION).toBe('FALSE');
  });

  it('D9/D20: archived businesses are excluded for every non-Owner role (related lists included)', () => {
    for (const role of ['data_entry', 'call_center', 'developer'] as const) {
      for (const action of ['business.read', 'deal.read', 'meeting.read', 'project.read', 'follow_up.read'] as Action[]) {
        const f = frag(role, action);
        expect(f.fr.live).toBe('af.archived_at IS NULL');
        expect(f.sql.startsWith('(af.archived_at IS NULL AND ')).toBe(true);
      }
    }
    expect(frag('owner', 'business.read').fr.live).toBe('TRUE');
  });

  // Changed expectation: the Developer now also carries row 6 (own open correction request, approved D9).
  it('DEC-002 visibility.dec002Rows gates each row; rows are role-specific', () => {
    const all = frag('developer', 'business.read').fr.rows;
    expect(all.R2_CLOSED_DEAL).not.toBe('FALSE');
    expect(all.R3_ACTIVE_PROJECT).not.toBe('FALSE');
    expect(all.R4_COMPLETED_PROJECT).not.toBe('FALSE');
    expect(all.R5_SCHEDULED_CALLBACK).toBe('FALSE');
    expect(all.R6_OPEN_CORRECTION).not.toBe('FALSE');
    const none = frag('developer', 'business.read', { 'visibility.dec002Rows': [] });
    expect(Object.values(none.fr.rows).every((s) => s === 'FALSE')).toBe(true);
    expect(none.fr.relation).toBe('FALSE');
    expect(none.sql).toBe('(af.archived_at IS NULL AND TRUE AND FALSE AND FALSE)');
    expect(frag('call_center', 'business.read', { 'visibility.dec002Rows': ['R1'] }).fr.rows.R5_SCHEDULED_CALLBACK).toBe('FALSE');
  });

  it('Table RT rule 4: context-limited items never reach general search; DV list = closed-deal list only', () => {
    expect(Object.values(frag('call_center', 'business.search').fr.rows).every((s) => s === 'FALSE')).toBe(true);
    expect(Object.values(frag('data_entry', 'business.list').fr.rows).every((s) => s === 'FALSE')).toBe(true);
    const dv = frag('developer', 'business.list').fr.rows;
    expect(dv.R2_CLOSED_DEAL).not.toBe('FALSE');
    expect(dv.R1_ACCEPTED_OPPORTUNITY).toBe('FALSE');
    expect(dv.R3_ACTIVE_PROJECT).toBe('FALSE');
    expect(dv.R6_OPEN_CORRECTION).toBe('FALSE');
    expect(frag('developer', 'business.search').sql).toBe('(af.archived_at IS NULL AND TRUE AND FALSE AND FALSE)');
  });

  it('grace values come from the registry: callback 48 h (row 5) and completed-project 15 days (rows 2/4)', () => {
    const cc = frag('call_center', 'business.read', { 'visibility.callbackGraceHours': 7 });
    expect(cc.params.values).toContain(7);
    const dv = frag('developer', 'business.read', { 'visibility.completedProjectDays': 9 });
    expect(dv.params.values).toContain(9);
  });

  // Changed expectation (approved D9): elapsed time has no calendar boundary, so the company timezone (and its
  // UTC+14 fail-closed fallback) no longer enters the rule table. `effectiveTimezone` keeps its own tests.
  it('the 15-day window does not depend on the company timezone (elapsed days)', () => {
    for (const tz of ['', 'UTC', 'Asia/Beirut']) {
      const f = frag('data_entry', 'business.read', { 'company.timezone': tz });
      expect(f.params.values).not.toContain('Etc/GMT-14');
      if (tz) expect(f.params.values).not.toContain(tz);
      expect(f.fr.window).not.toContain('timezone(');
    }
  });
});

// ---------------------------------------------------------------------------
// Custom roles (migration 014; authz-matrix.md §3.11) — TURNED OFF in v1.
// Fixed v1 scope (docs/policy-baseline-2026-10-29.md, approved): four roles, no custom-role management.
// Changed expectations: these tests used to prove that validated grants opened access; they now prove that a
// custom role id gets nothing even WITH a stored grant (the data is kept, the feature is off). The grant-
// semantics tests that have no refusal equivalent (department scope, second-factor gate on grantable rows)
// are skipped with that reason rather than deleted, so re-enabling the feature has a starting point.
// ---------------------------------------------------------------------------
describe('custom roles are off in v1 (fixed four roles): refused everywhere, grants ignored', () => {
  const HR = 'human_resources';
  const grants: Record<string, Record<string, DataScope>> = {};
  beforeAll(() => {
    registerDynamicRoleChecker({ grantFor: (role, action) => grants[role]?.[action] ?? null, ensureReady: async () => {} });
  });
  const run = (action: string, role: Role, sessionState: Principal['sessionState'] = 'active'): Promise<Captured> =>
    new Promise((resolve) => {
      const out: Captured = { nexted: false };
      const req = { user: { id: U, role, sessionState, sessionId: 's' }, requestId: 'r' } as unknown as Request;
      const res = {
        status(code: number) {
          out.status = code;
          return this;
        },
        json(body: { code?: string }) {
          out.body = body;
          resolve(out);
          return this;
        },
      } as unknown as Response;
      void requireAction(action as Action)(req, res, () => {
        out.nexted = true;
        resolve(out);
      });
    });
  const frag = (role: Role, action: Action, dataScope: DataScope | null, over: Partial<RuleFlags> = {}) => {
    const params = new SqlParams();
    const fr = buildRuleFragments({ role, employeeId: U, action, resourceType: 'business', now: new Date(), flags: baseFlags(over), params, dataScope });
    return { fr, sql: combinedPredicate(fr) };
  };
  const NOTHING = '(af.archived_at IS NULL AND FALSE AND FALSE AND FALSE)';

  it('the feature switch is off', () => {
    expect(CUSTOM_ROLES_ENABLED).toBe(false);
    expect(isSystemRole(HR)).toBe(false);
  });

  it('rule table: a custom or unknown role gets nothing on every surface, with or without a grant', () => {
    for (const role of [HR, 'typo_role', 'OWNER']) {
      for (const action of ['business.read', 'business.list', 'business.search', 'deal.read'] as Action[]) {
        for (const scope of [null, 'global', 'self', 'department', 'assigned_only'] as const) {
          const { fr, sql } = frag(role, action, scope);
          expect(sql, `${role} ${action} ${scope}`).toBe(NOTHING);
          expect(Object.values(fr.rows).every((s) => s === 'FALSE')).toBe(true);
        }
      }
    }
  });

  it('a system role ignores dataScope: the matrix rule is the whole answer', () => {
    expect(frag('developer', 'business.read', 'global').fr.window).toBe('FALSE');
    expect(frag('developer', 'business.read', 'global').fr.relation).toContain("af.deal_stage = 'closed'");
    expect(frag('developer', 'business.search', 'global').sql).toBe('(af.archived_at IS NULL AND TRUE AND FALSE AND FALSE)');
    expect(frag('call_center', 'business.read', 'global').fr.relation).toContain('af.assignee_id = $1::uuid');
  });

  it('Developer: never full through the window; relation = context rows; list = row 2 only', () => {
    const read = frag('developer', 'business.read', null, { 'deals.developerPreClosure': 'assigned' }).fr;
    expect(read.window).toBe('FALSE');
    for (const r of ['R1_ACCEPTED_OPPORTUNITY', 'R2_CLOSED_DEAL', 'R3_ACTIVE_PROJECT', 'R4_COMPLETED_PROJECT', 'R6_OPEN_CORRECTION'] as const) {
      expect(read.relation).toContain(read.rows[r]);
    }
    const list = frag('developer', 'business.list', null).fr;
    expect(list.relation).toBe(`(${list.rows.R2_CLOSED_DEAL})`);
    expect(list.rows.R3_ACTIVE_PROJECT).toBe('FALSE');
  });

  it('requireAction: a custom role is FORBIDDEN_ROLE on every matrix action, even holding grants', async () => {
    delete grants[HR];
    for (const action of Object.keys(AUTHZ_MATRIX)) {
      const r = await run(action, HR);
      expect(r.nexted, action).toBe(false);
      expect(r.body?.code).toBe('FORBIDDEN_ROLE');
    }
    grants[HR] = { 'attendance.read': 'global', 'business.read': 'global', 'attendance.overview.read': 'global' };
    for (const action of Object.keys(grants[HR])) {
      const r = await run(action, HR);
      expect(r.nexted, action).toBe(false);
      expect(r.body?.code).toBe('FORBIDDEN_ROLE');
    }
    expect(can({ employeeId: U, role: HR, sessionState: 'active' }, 'attendance.read' as Action)).toBe(false);
    delete grants[HR];
  });

  it('custom-role management is allowed to nobody (role.create / role.update / role.delete)', async () => {
    for (const a of ['role.create', 'role.update', 'role.delete']) {
      expect(AUTHZ_MATRIX[a].roles).toEqual([]);
      for (const role of ROLES) expect((await run(a, role)).body?.code, `${a} ${role}`).toBe('FORBIDDEN_ROLE');
    }
  });

  it.skip("v1-disabled: a grantable admin row needs the holder's verified second factor (custom roles are off; nothing is grantable)", () => {});

  it('the four system roles are never widened by a grant', async () => {
    grants.data_entry = { 'employee.list': 'global', 'audit.read': 'global' };
    grants.developer = { 'business.create': 'global' };
    try {
      expect((await run('employee.list', 'data_entry')).body?.code).toBe('FORBIDDEN_ROLE');
      expect((await run('audit.read', 'data_entry')).body?.code).toBe('FORBIDDEN_ROLE');
      expect((await run('business.create', 'developer')).body?.code).toBe('FORBIDDEN_ROLE');
      expect(can(principal('data_entry'), 'employee.list' as Action)).toBe(false);
    } finally {
      delete grants.data_entry;
      delete grants.developer;
    }
  });

  it('engine: own-record types ignore custom grants (own records only, never global)', async () => {
    registerResourceResolver('attendance_session', async (_db, id) => ({ kind: 'own', ownerIds: [id === B ? U : B2] }));
    const hr = (): Principal => ({ employeeId: U, role: HR, sessionState: 'active' });
    const e = engine();
    const ref = { type: 'attendance_session' as const, id: B2 };
    for (const scope of ['global', 'department', 'self'] as const) {
      grants[HR] = { 'attendance.read': scope };
      expect(await e.check(dbWith([]), hr(), 'attendance.read' as Action, ref)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(e.scopeFilter(hr(), 'attendance.read' as Action, 'attendance_session', { alias: 's', params: new SqlParams() })).toBe('s.employee_id = $1');
    }
    delete grants[HR];
  });

  it.skip('v1-disabled: department data_scope on own-record types (custom roles are off; no grant is honoured)', () => {});

  it('grantRefusal: matrix membership, nobody rows (custom-role management included) and unmarked admin rows', () => {
    expect(grantRefusal('business.read')).toBeUndefined();
    expect(grantRefusal('nope.action')).toMatch(/not an action/);
    for (const a of ['business.delete', 'audit.update', 'role.create', 'role.update', 'role.delete']) expect(grantRefusal(a), a).toMatch(/nobody/);
    for (const a of ['employee.create', 'employee.update', 'settings.update', 'report.export', 'audit.read', 'business.archive', 'deal.finalize']) {
      expect(grantRefusal(a), a).toMatch(/Owner-only administrative/);
    }
  });

  it('DynamicRoleCache still loads the kept role_permissions data (read-only; the engine never consults it in v1)', async () => {
    const db = new FakeDb().on(/FROM role_permissions/, [
      { role_id: HR, action: 'business.read', data_scope: 'self' },
      { role_id: 'data_entry', action: 'employee.list', data_scope: 'global' }, // system role: dropped
    ]);
    const cache = new DynamicRoleCache();
    cache.attach(db);
    await cache.ensureReady();
    expect(cache.grantFor(HR, 'business.read' as Action)).toBe('self');
    expect(cache.grantFor('data_entry', 'employee.list' as Action)).toBeNull();
    registerDynamicRoleChecker(cache);
    expect(dynamicGrantFor(HR, 'business.read' as Action)).toBeNull();
  });
});
