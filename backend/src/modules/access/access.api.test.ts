/**
 * MOD-access contract tests on the Docker test DB (TEST_DATABASE_URL). Owner: BE2.
 *
 * 1. The access_facts view (migration 900) exposes exactly the contracted columns.
 * 2. VT-7 worked evaluations (batch2-spec §7.8) for each role × timer side × exception row run
 *    against `check` AND `scopeFilter`, and both must agree. The facts for rows fed by BE3/BE4
 *    tables (not built yet) come from a session-local TEMP view named access_facts, which Postgres
 *    resolves before the public view (pg_temp is first on the search path). The engine SQL is the
 *    production SQL; only the fact source is substituted.
 * 3. Real-view cases on `businesses`: day-16 boundary, company-timezone boundary, hidden rows never
 *    counted, Owner hidden read audited (OI-05).
 * Skipped without TEST_DATABASE_URL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { Role } from '../../middleware/auth.js';
import type { AccessDecision, Action, Principal } from '../../shared/access.js';
import { loadPolicyFlags } from '../../shared/flags.js';
import { SqlParams } from '../../shared/sql.js';
import { pool, query, withTransaction } from '../../db/pool.js';
import { audit } from '../../shared/tx.js';
import { createAccessEngine, auditOwnerHiddenRead, OWNER_VIEWED_HIDDEN_EVENT } from './service.js';
import { ACCESS_FACT_COLUMNS, type RuleFlags } from './rules.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const NOW = new Date('2026-10-23T12:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

const baseFlags = (over: Partial<RuleFlags> = {}): RuleFlags => ({ ...loadPolicyFlags({}), ...over });
const engineWith = (over: Partial<RuleFlags> = {}, now: Date = NOW) => createAccessEngine({ now: () => now, flags: () => baseFlags(over) });
const who = (role: Role, employeeId: string = randomUUID(), sessionState: Principal['sessionState'] = 'active'): Principal => ({ employeeId, role, sessionState });

interface Facts {
  business_id?: string;
  created_by?: string;
  created_at?: Date;
  archived_at?: Date | null;
  last_touchpoint_at?: Date | null;
  assignee_id?: string | null;
  open_follow_up_responsible_id?: string | null;
  open_follow_up_at?: Date | null;
  deal_id?: string | null;
  deal_stage?: string | null;
  deal_developer_ids?: string[];
  project_id?: string | null;
  project_status?: string | null;
  project_developer_ids?: string[];
  project_completed_at?: Date | null;
  has_open_correction?: boolean;
}

describe.skipIf(!hasTestDb)('access engine contract (Docker test DB)', () => {
  let client: pg.PoolClient;

  /** Insert one facts row into the session-local fixture; returns its business id. */
  async function facts(f: Facts): Promise<string> {
    const id = f.business_id ?? randomUUID();
    await client.query(
      `INSERT INTO facts_fixture (business_id, created_by, created_at, archived_at, last_touchpoint_at, assignee_id,
         open_follow_up_responsible_id, open_follow_up_at, deal_id, deal_stage, deal_developer_ids,
         project_id, project_status, project_developer_ids, project_completed_at, has_open_correction)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid[],$12,$13,$14::uuid[],$15,$16)`,
      [
        id,
        f.created_by ?? randomUUID(),
        f.created_at ?? days(0),
        f.archived_at ?? null,
        f.last_touchpoint_at ?? null,
        f.assignee_id ?? null,
        f.open_follow_up_responsible_id ?? null,
        f.open_follow_up_at ?? null,
        f.deal_id ?? null,
        f.deal_stage ?? null,
        f.deal_developer_ids ?? [],
        f.project_id ?? null,
        f.project_status ?? null,
        f.project_developer_ids ?? [],
        f.project_completed_at ?? null,
        f.has_open_correction ?? false,
      ]
    );
    return id;
  }

  /** Runs `check` and `scopeFilter` for the same case and asserts they agree. Returns the check decision. */
  async function both(
    e: ReturnType<typeof createAccessEngine>,
    p: Principal,
    action: Action,
    businessId: string,
    table = 'facts_fixture',
    idColumn = 'business_id',
    db: { query: pg.PoolClient['query'] } = client
  ): Promise<AccessDecision> {
    const decision = await e.check(db, p, action, { type: 'business', id: businessId });
    const params = new SqlParams();
    const pred = e.scopeFilter(p, action, 'business', { alias: 't', params, idColumn });
    const idP = params.add(businessId);
    const { rows } = await db.query<{ n: string }>(`SELECT count(*)::int AS n FROM ${table} t WHERE t.${idColumn} = ${idP} AND ${pred}`, params.values);
    expect(Number(rows[0].n), `scopeFilter must agree with check (${JSON.stringify(decision)})`).toBe(decision.allowed ? 1 : 0);
    return decision;
  }

  beforeAll(async () => {
    client = await pool.connect();
    const cols = ACCESS_FACT_COLUMNS.join(', ');
    await client.query(`CREATE TEMP TABLE facts_fixture AS SELECT ${cols} FROM access_facts WHERE FALSE`);
    await client.query('CREATE TEMP VIEW access_facts AS SELECT * FROM facts_fixture');
  });

  afterAll(async () => {
    await client.query('DROP VIEW IF EXISTS pg_temp.access_facts');
    await client.query('DROP TABLE IF EXISTS pg_temp.facts_fixture');
    client.release();
    await pool.end();
  });

  it('migration 900: access_facts exposes exactly the contracted columns, in order', async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'access_facts' ORDER BY ordinal_position`
    );
    expect(rows.map((r) => r.column_name)).toEqual([...ACCESS_FACT_COLUMNS]);
    const { rows: fx } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'facts_fixture' ORDER BY ordinal_position`
    );
    expect(fx.map((r) => r.column_name)).toEqual([...ACCESS_FACT_COLUMNS]);
  });

  describe('VT-7 worked evaluations: Call Center', () => {
    it('assigned, created day 0, now day 10 → Full under both timer bases', async () => {
      const cc = who('call_center');
      const id = await facts({ created_at: days(-10), assignee_id: cc.employeeId });
      for (const basis of ['creation', 'inactivity'] as const) {
        expect(await both(engineWith({ 'visibility.timerBasis': basis }), cc, 'business.read', id)).toEqual({ allowed: true, level: 'full' });
      }
    });

    it('assigned, created day 0, call_attempt.logged day 12, now day 20, no follow-up → Alt A hidden / Alt B full', async () => {
      const cc = who('call_center');
      const id = await facts({ created_at: days(-20), last_touchpoint_at: days(-8), assignee_id: cc.employeeId });
      expect(await both(engineWith({ 'visibility.timerBasis': 'creation' }), cc, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      expect(await both(engineWith({ 'visibility.timerBasis': 'inactivity' }), cc, 'business.read', id)).toEqual({ allowed: true, level: 'full' });
    });

    it('follow_up.scheduled day 18 for day 22, now day 20 → Alt A row 5 context-limited / Alt B full', async () => {
      const cc = who('call_center');
      const id = await facts({
        created_at: days(-20),
        last_touchpoint_at: days(-2),
        assignee_id: cc.employeeId,
        open_follow_up_responsible_id: cc.employeeId,
        open_follow_up_at: days(2),
      });
      expect(await both(engineWith({ 'visibility.timerBasis': 'creation' }), cc, 'business.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R5_SCHEDULED_CALLBACK' });
      expect(await both(engineWith({ 'visibility.timerBasis': 'inactivity' }), cc, 'business.read', id)).toEqual({ allowed: true, level: 'full' });
      // Row 5 ends at callback time + 48 h (visibility.callbackGraceHours).
      const late = engineWith({ 'visibility.timerBasis': 'creation' }, hours(2 * 24 + 49));
      expect(await both(late, cc, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      const withinGrace = engineWith({ 'visibility.timerBasis': 'creation' }, hours(2 * 24 + 47));
      expect(await both(withinGrace, cc, 'business.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R5_SCHEDULED_CALLBACK' });
      // Row 5 off (CFG) → hidden. Context rows never reach general search.
      expect(await both(engineWith({ 'visibility.timerBasis': 'creation', 'visibility.dec002Rows': ['R1', 'R2', 'R3', 'R4', 'R6'] }), cc, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      expect(await both(engineWith({ 'visibility.timerBasis': 'creation' }), cc, 'business.search', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    });

    it('assigned day 14, created day 0, no contact, now day 16 → hidden under both (B7: assigned but inaccessible)', async () => {
      const cc = who('call_center');
      const id = await facts({ created_at: days(-16), assignee_id: cc.employeeId });
      for (const basis of ['creation', 'inactivity'] as const) {
        expect(await both(engineWith({ 'visibility.timerBasis': basis }), cc, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      }
    });

    it('not assigned → permission denied (step 6), even on a fresh record with an accepted deal', async () => {
      const cc = who('call_center');
      const id = await facts({ created_at: days(-1), assignee_id: randomUUID(), deal_stage: 'accepted_opportunity' });
      expect(await both(engineWith(), cc, 'business.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    it('SEC R1: follow-up responsible but no longer assigned, window open → row 5 context-limited, never full', async () => {
      const cc = who('call_center');
      const id = await facts({
        created_at: days(-3),
        assignee_id: randomUUID(),
        open_follow_up_responsible_id: cc.employeeId,
        open_follow_up_at: days(1),
      });
      for (const basis of ['creation', 'inactivity'] as const) {
        expect(await both(engineWith({ 'visibility.timerBasis': basis }), cc, 'business.read', id)).toEqual({
          allowed: true,
          level: 'context_limited',
          exceptionRow: 'R5_SCHEDULED_CALLBACK',
        });
      }
      // Not on the directory or search surfaces, and nothing at all once row 5 is switched off.
      expect(await both(engineWith(), cc, 'business.list', id)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(engineWith(), cc, 'business.search', id)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(engineWith({ 'visibility.dec002Rows': ['R1', 'R2', 'R3', 'R4', 'R6'] }), cc, 'business.read', id)).toEqual({
        allowed: false,
        reason: 'permission_denied',
      });
    });

    it('row 1: assigned agent keeps the accepted-opportunity record after the window', async () => {
      const cc = who('call_center');
      const id = await facts({ created_at: days(-30), assignee_id: cc.employeeId, deal_id: randomUUID(), deal_stage: 'accepted_opportunity' });
      expect(await both(engineWith(), cc, 'deal.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R1_ACCEPTED_OPPORTUNITY' });
      const closed = await facts({ created_at: days(-30), assignee_id: cc.employeeId, deal_id: randomUUID(), deal_stage: 'closed' });
      expect(await both(engineWith(), cc, 'deal.read', closed)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    });
  });

  describe('VT-7 worked evaluations: Developer', () => {
    it('not assigned, closed deal + active project, created day 0, now day 40 → row 2 context-limited (closed-deal list)', async () => {
      const dv = who('developer');
      const id = await facts({ created_at: days(-40), deal_id: randomUUID(), deal_stage: 'closed', project_id: randomUUID(), project_status: 'in_progress' });
      for (const basis of ['creation', 'inactivity'] as const) {
        expect(await both(engineWith({ 'visibility.timerBasis': basis }), dv, 'business.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R2_CLOSED_DEAL' });
      }
      // Closed-deal list is a list surface for Developers; general search is not.
      expect(await both(engineWith(), dv, 'business.list', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R2_CLOSED_DEAL' });
      expect(await both(engineWith(), dv, 'business.search', id)).toEqual({ allowed: false, reason: 'permission_denied' });
      // Row 2 off → no relation at all for a non-assigned Developer.
      expect(await both(engineWith({ 'visibility.dec002Rows': ['R1', 'R3', 'R4', 'R5', 'R6'] }), dv, 'business.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    it('assigned on an accepted-opportunity deal, day 5 → DEC-005 assigned: context-limited row 1 / closedOnly: permission denied', async () => {
      const dv = who('developer');
      const id = await facts({ created_at: days(-5), deal_id: randomUUID(), deal_stage: 'accepted_opportunity', deal_developer_ids: [dv.employeeId] });
      expect(await both(engineWith({ 'deals.developerPreClosure': 'assigned' }), dv, 'deal.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R1_ACCEPTED_OPPORTUNITY' });
      expect(await both(engineWith({ 'deals.developerPreClosure': 'closedOnly' }), dv, 'deal.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
      const other = who('developer');
      expect(await both(engineWith({ 'deals.developerPreClosure': 'assigned' }), other, 'deal.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    it('rows 3/4: assigned Developer on an active project, then completed (15 days after delivery)', async () => {
      const dv = who('developer');
      const active = await facts({ created_at: days(-60), project_id: randomUUID(), project_status: 'in_progress', project_developer_ids: [dv.employeeId] });
      expect(await both(engineWith(), dv, 'project.read', active)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R3_ACTIVE_PROJECT' });
      const done = await facts({ created_at: days(-60), project_id: randomUUID(), project_status: 'completed', project_completed_at: days(-10), project_developer_ids: [dv.employeeId] });
      expect(await both(engineWith(), dv, 'project.read', done)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R4_COMPLETED_PROJECT' });
      const stale = await facts({ created_at: days(-60), deal_stage: 'closed', project_id: randomUUID(), project_status: 'completed', project_completed_at: days(-16), project_developer_ids: [dv.employeeId] });
      // Row 4 ended (16 > 15 days) and row 2 ended (project completed + 15 days) → no relation.
      expect(await both(engineWith(), dv, 'project.read', stale)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(engineWith({ 'visibility.completedProjectDays': 30 }), dv, 'project.read', stale)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R2_CLOSED_DEAL' });
    });
  });

  describe('VT-7 worked evaluations: Data Entry', () => {
    it('created by U day 0, now day 20, open correction request → row 6 context-limited; search still hidden', async () => {
      const de = who('data_entry');
      const id = await facts({ created_at: days(-20), created_by: de.employeeId, has_open_correction: true });
      for (const basis of ['creation', 'inactivity'] as const) {
        expect(await both(engineWith({ 'visibility.timerBasis': basis }), de, 'business.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R6_OPEN_CORRECTION' });
      }
      expect(await both(engineWith(), de, 'business.search', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      expect(await both(engineWith(), de, 'business.list', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      const noReq = await facts({ created_at: days(-20), created_by: de.employeeId });
      expect(await both(engineWith(), de, 'business.read', noReq)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    });

    it('created by another user, now day 3 → DE-1 full / DE-2 denied unless in the correction queue', async () => {
      const de = who('data_entry');
      const id = await facts({ created_at: days(-3) });
      expect(await both(engineWith({ 'access.dataEntryScope': 'DE-1' }), de, 'business.read', id)).toEqual({ allowed: true, level: 'full' });
      expect(await both(engineWith({ 'access.dataEntryScope': 'DE-2' }), de, 'business.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
      const queued = await facts({ created_at: days(-3), has_open_correction: true });
      expect(await both(engineWith({ 'access.dataEntryScope': 'DE-2' }), de, 'business.read', queued)).toEqual({ allowed: true, level: 'full' });
      const own = await facts({ created_at: days(-3), created_by: de.employeeId });
      expect(await both(engineWith({ 'access.dataEntryScope': 'DE-2' }), de, 'business.read', own)).toEqual({ allowed: true, level: 'full' });
    });
  });

  describe('VT-7 worked evaluations: Owner', () => {
    it('2FA complete: Owner access on any business, any age; hidden-for-others flagged for OI-05', async () => {
      const o = who('owner');
      const fresh = await facts({ created_at: days(-1) });
      const old = await facts({ created_at: days(-100) });
      expect(await both(engineWith(), o, 'business.read', fresh)).toEqual({ allowed: true, level: 'owner' });
      expect(await both(engineWith(), o, 'business.read', old)).toEqual({ allowed: true, level: 'owner', ownerViewedHidden: true });
      expect(await both(engineWith({ 'access.auditOwnerHiddenReads': false }), o, 'business.read', old)).toEqual({ allowed: true, level: 'owner' });
    });

    it('2FA pending: R11-a denied / R11-b Owner', async () => {
      const o = who('owner', randomUUID(), 'pending_2fa_verification');
      const id = await facts({ created_at: days(-1) });
      expect(await both(engineWith({ 'auth.ownerPending2faScope': 'R11-a' }), o, 'business.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(engineWith({ 'auth.ownerPending2faScope': 'R11-b' }), o, 'business.read', id)).toEqual({ allowed: true, level: 'owner' });
    });

    it('any role: a business that does not exist → not found, with no other information', async () => {
      for (const role of ['owner', 'data_entry', 'call_center', 'developer'] as const) {
        const d = await engineWith().check(client, who(role), 'business.read', { type: 'business', id: randomUUID() });
        expect(d).toEqual({ allowed: false, reason: 'not_found' });
      }
    });
  });

  describe('day-16 boundary (OI-04) and company timezone', () => {
    it('hidden from 00:00 company time on created-date + 15; visible the day before', async () => {
      const de = who('data_entry');
      const e = engineWith({ 'company.timezone': 'UTC' }, new Date('2026-10-23T12:00:00Z'));
      const day15 = await facts({ created_at: new Date('2026-10-08T23:59:00Z') }); // created-date + 15 = Oct 23 → hidden
      const day14 = await facts({ created_at: new Date('2026-10-09T00:01:00Z') }); // created-date + 15 = Oct 24 → visible
      expect(await both(e, de, 'business.read', day15)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      expect(await both(e, de, 'business.read', day14)).toEqual({ allowed: true, level: 'full' });
    });

    it('the company timezone decides which calendar day it is; NOT CONFIGURED fails closed at UTC+14 (SEC R4)', async () => {
      const de = who('data_entry');
      const now = new Date('2026-10-23T22:30:00Z'); // Oct 23 UTC, already Oct 24 in Asia/Beirut (UTC+3)
      const id = await facts({ created_at: new Date('2026-10-09T06:00:00Z') }); // Oct 9 in all three zones → +15 = Oct 24
      expect(await both(engineWith({ 'company.timezone': 'UTC' }, now), de, 'business.read', id)).toEqual({ allowed: true, level: 'full' });
      expect(await both(engineWith({ 'company.timezone': 'Asia/Beirut' }, now), de, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      // R4: an unset timezone must not mean "open": the earliest zone (Etc/GMT-14) reaches day 16 first.
      expect(await both(engineWith({ 'company.timezone': '' }, now), de, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      const earlier = new Date('2026-10-23T09:00:00Z'); // Oct 23 23:00 at UTC+14: still day 15 everywhere
      expect(await both(engineWith({ 'company.timezone': '' }, earlier), de, 'business.read', id)).toEqual({ allowed: true, level: 'full' });
    });
  });

  describe('real view (migrations 200 + 900) on businesses', () => {
    let creator: string;
    let owner: string;
    let visibleId: string;
    let hiddenId: string;
    const tag = `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    beforeAll(async () => {
      const emp = async (role: Role) => {
        const { rows } = await query<{ id: string }>(
          `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'Access Test', $2, true) RETURNING id`,
          [`${tag}.${role}@test.local`, role]
        );
        return rows[0].id;
      };
      creator = await emp('data_entry');
      owner = await emp('owner');
      const biz = async (createdAt: Date) => {
        const { rows } = await query<{ id: string }>(
          `INSERT INTO businesses (name, created_by, created_at) VALUES ($1, $2, $3) RETURNING id`,
          [`${tag} business`, creator, createdAt]
        );
        return rows[0].id;
      };
      visibleId = await biz(days(-1));
      hiddenId = await biz(days(-16));
    });

    it('check: Data Entry full on day 1, hidden on day 16; Call Center not assigned → permission denied', async () => {
      const e = engineWith();
      const de = who('data_entry', creator);
      expect(await both(e, de, 'business.read', visibleId, 'businesses', 'id', pool)).toEqual({ allowed: true, level: 'full' });
      expect(await both(e, de, 'business.read', hiddenId, 'businesses', 'id', pool)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      expect(await both(e, who('call_center'), 'business.read', visibleId, 'businesses', 'id', pool)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    it('lists: hidden rows are omitted and never counted; the Owner counts both', async () => {
      const e = engineWith();
      const count = async (p: Principal) => {
        const params = new SqlParams();
        const tagP = params.add(`${tag} business`);
        const pred = e.scopeFilter(p, 'business.list', 'business', { alias: 'b', params });
        const { rows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM businesses b WHERE b.name = ${tagP} AND ${pred}`, params.values);
        return rows[0].n;
      };
      expect(await count(who('data_entry', creator))).toBe(1);
      expect(await count(who('call_center'))).toBe(0);
      expect(await count(who('developer'))).toBe(0);
      expect(await count(who('owner', owner))).toBe(2);
      expect(await count(who('owner', owner, 'pending_2fa_verification'))).toBe(0);
    });

    it('Owner opening a hidden detail: decision flags it and the audit row is written in the transaction', async () => {
      const e = engineWith();
      const d = await e.check(pool, who('owner', owner), 'business.read', { type: 'business', id: hiddenId });
      expect(d).toEqual({ allowed: true, level: 'owner', ownerViewedHidden: true });
      await withTransaction((tx) =>
        auditOwnerHiddenRead(
          { tx, actor: { kind: 'employee', employeeId: owner, role: 'owner', sessionId: randomUUID(), sessionState: 'active' }, requestId: 'r', clientIp: null, now: NOW },
          hiddenId
        )
      );
      const { rows } = await query<{ event_name: string; actor_id: string }>(
        `SELECT event_name, actor_id FROM audit_events WHERE entity_type = 'business' AND entity_id = $1`,
        [hiddenId]
      );
      expect(rows).toEqual([{ event_name: OWNER_VIEWED_HIDDEN_EVENT, actor_id: owner }]);
      // The helper is a thin wrapper over the shared audit(); same transaction semantics.
      expect(typeof audit).toBe('function');
    });
  });
});
