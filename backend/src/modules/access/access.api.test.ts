/**
 * MOD-access contract tests on the Docker test DB (TEST_DATABASE_URL). Owner: BE2.
 *
 * 1. The access_facts view (migration 900 → 992) exposes exactly the contracted columns.
 * 2. Worked evaluations of the APPROVED policy (docs/policy-baseline-2026-10-29.md §D9, §D15, §D20) for each
 *    role × window side × exception row run against `check` AND `scopeFilter`, and both must agree. The facts
 *    come from a session-local TEMP view named access_facts, which Postgres resolves before the public view
 *    (pg_temp is first on the search path). The engine SQL is the production SQL; only the fact source is
 *    substituted.
 * 3. Real-view cases on `businesses`: the elapsed 15-day boundary, the Call Center assignment window and
 *    reassignment, correction requester access, archived exclusion, hidden rows never counted, Owner hidden
 *    read audited (OI-05).
 *
 * Changed expectations (approved policy): the DEC-001 `inactivity` basis and the company-day boundary are gone
 * (15 ELAPSED days; Call Center from assignment); a former assignee keeps no row-5 access; Call Center has no
 * row-1 (accepted opportunity) access; row 2 needs an active project (or completion < 15 days); row 6 follows
 * the requester; archived businesses are not found for non-Owners.
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
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

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
  assignment_started_at?: Date | null;
  open_correction_requester_ids?: string[];
}

describe.skipIf(!hasTestDb)('access engine contract (Docker test DB)', () => {
  let client: pg.PoolClient;

  /** Insert one facts row into the session-local fixture; returns its business id. */
  async function facts(f: Facts): Promise<string> {
    const id = f.business_id ?? randomUUID();
    await client.query(
      `INSERT INTO facts_fixture (business_id, created_by, created_at, archived_at, last_touchpoint_at, assignee_id,
         open_follow_up_responsible_id, open_follow_up_at, deal_id, deal_stage, deal_developer_ids,
         project_id, project_status, project_developer_ids, project_completed_at, has_open_correction,
         assignment_started_at, open_correction_requester_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid[],$12,$13,$14::uuid[],$15,$16,$17,$18::uuid[])`,
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
        f.has_open_correction ?? (f.open_correction_requester_ids?.length ? true : false),
        // An assigned fixture row without an explicit start was assigned when the business was created.
        f.assignment_started_at ?? (f.assignee_id ? f.created_at ?? days(0) : null),
        f.open_correction_requester_ids ?? [],
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

  it('migrations 900–992: access_facts exposes exactly the contracted columns, in order (992 appends two)', async () => {
    const { rows } = await query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'access_facts' ORDER BY ordinal_position`
    );
    expect(rows.map((r) => r.column_name)).toEqual([...ACCESS_FACT_COLUMNS]);
    expect(rows.slice(-2)).toEqual([
      { column_name: 'assignment_started_at', data_type: 'timestamp with time zone' },
      { column_name: 'open_correction_requester_ids', data_type: 'ARRAY' },
    ]);
    const { rows: fx } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'facts_fixture' ORDER BY ordinal_position`
    );
    expect(fx.map((r) => r.column_name)).toEqual([...ACCESS_FACT_COLUMNS]);
  });

  describe('D9 Call Center: 15 elapsed days from the CURRENT assignment', () => {
    it('assigned 10 days ago → full', async () => {
      const cc = who('call_center');
      const id = await facts({ created_at: days(-10), assignee_id: cc.employeeId });
      expect(await both(engineWith(), cc, 'business.read', id)).toEqual({ allowed: true, level: 'full' });
    });

    it('window is measured from assignment, not creation: created 40 days ago, assigned 5 days ago → full', async () => {
      const cc = who('call_center');
      const id = await facts({ created_at: days(-40), assignee_id: cc.employeeId, assignment_started_at: days(-5) });
      expect(await both(engineWith(), cc, 'business.read', id)).toEqual({ allowed: true, level: 'full' });
      expect(await both(engineWith(), cc, 'business.list', id)).toEqual({ allowed: true, level: 'full' });
    });

    it('elapsed boundary: 1 minute before 15 × 24 h → full; 1 minute after → hidden', async () => {
      const cc = who('call_center');
      const before = await facts({ created_at: days(-30), assignee_id: cc.employeeId, assignment_started_at: minutes(-(15 * 24 * 60 - 1)) });
      const after = await facts({ created_at: days(-30), assignee_id: cc.employeeId, assignment_started_at: minutes(-(15 * 24 * 60 + 1)) });
      expect(await both(engineWith(), cc, 'business.read', before)).toEqual({ allowed: true, level: 'full' });
      expect(await both(engineWith(), cc, 'business.read', after)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    });

    it('interactions never reset the window: a call logged yesterday does not reopen a 20-day-old assignment', async () => {
      const cc = who('call_center');
      const id = await facts({ created_at: days(-20), last_touchpoint_at: days(-1), assignee_id: cc.employeeId });
      expect(await both(engineWith(), cc, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    });

    it('callback: assigned agent keeps row 5 through callback time + 48 h; then hidden; never on search', async () => {
      const cc = who('call_center');
      const id = await facts({
        created_at: days(-20),
        assignee_id: cc.employeeId,
        open_follow_up_responsible_id: cc.employeeId,
        open_follow_up_at: days(2),
      });
      expect(await both(engineWith(), cc, 'business.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R5_SCHEDULED_CALLBACK' });
      expect(await both(engineWith({}, hours(2 * 24 + 47)), cc, 'business.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R5_SCHEDULED_CALLBACK' });
      expect(await both(engineWith({}, hours(2 * 24 + 49)), cc, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      expect(await both(engineWith({ 'visibility.dec002Rows': ['R1', 'R2', 'R3', 'R4', 'R6'] }), cc, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      expect(await both(engineWith(), cc, 'business.search', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    });

    // Changed expectation (was: row 5 context-limited for the former assignee, SEC R1).
    it('reassignment ends the old agent’s access: still follow-up responsible but no longer assigned → permission denied', async () => {
      const former = who('call_center');
      const current = who('call_center');
      const id = await facts({
        created_at: days(-3),
        assignee_id: current.employeeId,
        assignment_started_at: days(-1),
        open_follow_up_responsible_id: former.employeeId,
        open_follow_up_at: days(1),
      });
      for (const action of ['business.read', 'business.list', 'business.search', 'follow_up.read'] as Action[]) {
        expect(await both(engineWith(), former, action, id), action).toEqual({ allowed: false, reason: 'permission_denied' });
      }
      // The new agent's window starts at the reassignment.
      expect(await both(engineWith(), current, 'business.read', id)).toEqual({ allowed: true, level: 'full' });
    });

    it('not assigned → permission denied (step 6), even on a fresh record with an accepted deal', async () => {
      const cc = who('call_center');
      const id = await facts({ created_at: days(-1), assignee_id: randomUUID(), deal_stage: 'accepted_opportunity' });
      expect(await both(engineWith(), cc, 'business.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    // Changed expectation (approved D15; was: row 1 context-limited for the assigned agent).
    it('D15: the assigned agent has NO accepted-opportunity access after the window (row 1 is Developer-only)', async () => {
      const cc = who('call_center');
      const id = await facts({ created_at: days(-30), assignee_id: cc.employeeId, deal_id: randomUUID(), deal_stage: 'accepted_opportunity' });
      expect(await both(engineWith(), cc, 'deal.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      expect(await both(engineWith(), cc, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    });
  });

  describe('D9/D15 Developer', () => {
    it('closed deal + active project, not assigned → row 2 context-limited (closed-deal list); never search', async () => {
      const dv = who('developer');
      const id = await facts({ created_at: days(-40), deal_id: randomUUID(), deal_stage: 'closed', project_id: randomUUID(), project_status: 'in_progress' });
      expect(await both(engineWith(), dv, 'business.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R2_CLOSED_DEAL' });
      expect(await both(engineWith(), dv, 'business.list', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R2_CLOSED_DEAL' });
      expect(await both(engineWith(), dv, 'business.search', id)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(engineWith({ 'visibility.dec002Rows': ['R1', 'R3', 'R4', 'R5', 'R6'] }), dv, 'business.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    // Changed expectation (was: row 2 true without a project).
    it('row 2 needs a project: closed deal with no project → denied for other Developers; the assigned Developer keeps it', async () => {
      const dv = who('developer');
      const assigned = who('developer');
      const id = await facts({ created_at: days(-40), deal_id: randomUUID(), deal_stage: 'closed', deal_developer_ids: [assigned.employeeId] });
      expect(await both(engineWith(), dv, 'business.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(engineWith(), dv, 'business.list', id)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(engineWith(), assigned, 'deal.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R2_CLOSED_DEAL' });
      // Once the project exists and is cancelled, the assigned Developer loses it too.
      const cancelled = await facts({ created_at: days(-40), deal_stage: 'closed', deal_developer_ids: [assigned.employeeId], project_id: randomUUID(), project_status: 'cancelled' });
      expect(await both(engineWith(), assigned, 'deal.read', cancelled)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    it('row 2: a cancelled project is not active (no access); a completed one gives 15 elapsed days', async () => {
      const dv = who('developer');
      const cancelled = await facts({ created_at: days(-40), deal_stage: 'closed', project_id: randomUUID(), project_status: 'cancelled' });
      expect(await both(engineWith(), dv, 'business.read', cancelled)).toEqual({ allowed: false, reason: 'permission_denied' });
      const recent = await facts({ created_at: days(-40), deal_stage: 'closed', project_id: randomUUID(), project_status: 'completed', project_completed_at: days(-14) });
      expect(await both(engineWith(), dv, 'business.read', recent)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R2_CLOSED_DEAL' });
      const old = await facts({ created_at: days(-40), deal_stage: 'closed', project_id: randomUUID(), project_status: 'completed', project_completed_at: days(-16) });
      expect(await both(engineWith(), dv, 'business.read', old)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    it('assigned on an accepted-opportunity deal → DEC-005 assigned: row 1 / closedOnly: denied; other Developer denied', async () => {
      const dv = who('developer');
      const id = await facts({ created_at: days(-5), deal_id: randomUUID(), deal_stage: 'accepted_opportunity', deal_developer_ids: [dv.employeeId] });
      expect(await both(engineWith({ 'deals.developerPreClosure': 'assigned' }), dv, 'deal.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R1_ACCEPTED_OPPORTUNITY' });
      expect(await both(engineWith({ 'deals.developerPreClosure': 'closedOnly' }), dv, 'deal.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(engineWith({ 'deals.developerPreClosure': 'assigned' }), who('developer'), 'deal.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    it('rows 3/4: assigned Developer on an active project, then completed (15 days); a cancelled assigned project → denied', async () => {
      const dv = who('developer');
      const active = await facts({ created_at: days(-60), project_id: randomUUID(), project_status: 'in_progress', project_developer_ids: [dv.employeeId] });
      expect(await both(engineWith(), dv, 'project.read', active)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R3_ACTIVE_PROJECT' });
      const done = await facts({ created_at: days(-60), project_id: randomUUID(), project_status: 'completed', project_completed_at: days(-10), project_developer_ids: [dv.employeeId] });
      expect(await both(engineWith(), dv, 'project.read', done)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R4_COMPLETED_PROJECT' });
      const stale = await facts({ created_at: days(-60), deal_stage: 'closed', project_id: randomUUID(), project_status: 'completed', project_completed_at: days(-16), project_developer_ids: [dv.employeeId] });
      expect(await both(engineWith(), dv, 'project.read', stale)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(engineWith({ 'visibility.completedProjectDays': 30 }), dv, 'project.read', stale)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R2_CLOSED_DEAL' });
      const cancelled = await facts({ created_at: days(-60), deal_stage: 'closed', project_id: randomUUID(), project_status: 'cancelled', project_developer_ids: [dv.employeeId] });
      expect(await both(engineWith(), dv, 'project.read', cancelled)).toEqual({ allowed: false, reason: 'permission_denied' });
    });
  });

  describe('D9 Data Entry: 15 elapsed days from creation', () => {
    it('elapsed boundary: created 15 × 24 h − 1 min ago → full; + 1 min → hidden (any company timezone)', async () => {
      const de = who('data_entry');
      const before = await facts({ created_at: minutes(-(15 * 24 * 60 - 1)) });
      const after = await facts({ created_at: minutes(-(15 * 24 * 60 + 1)) });
      for (const tz of ['', 'UTC', 'Asia/Beirut']) {
        expect(await both(engineWith({ 'company.timezone': tz }), de, 'business.read', before), tz).toEqual({ allowed: true, level: 'full' });
        expect(await both(engineWith({ 'company.timezone': tz }), de, 'business.read', after), tz).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      }
    });

    it('editing / touchpoints do not restart the window', async () => {
      const de = who('data_entry');
      const id = await facts({ created_at: days(-16), last_touchpoint_at: days(-1) });
      expect(await both(engineWith(), de, 'business.read', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    });

    it('open correction request (reviewer role) → row 6 context-limited; never list or search', async () => {
      const de = who('data_entry');
      const id = await facts({ created_at: days(-20), created_by: de.employeeId, has_open_correction: true });
      expect(await both(engineWith(), de, 'business.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R6_OPEN_CORRECTION' });
      expect(await both(engineWith(), de, 'business.search', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      expect(await both(engineWith(), de, 'business.list', id)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      const noReq = await facts({ created_at: days(-20), created_by: de.employeeId });
      expect(await both(engineWith(), de, 'business.read', noReq)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    });

    it('created by another user, day 3 → DE-1 full / DE-2 denied unless in the correction queue', async () => {
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

  describe('D9 correction requester keeps context access while the request is open', () => {
    it('Call Center requester, no longer assigned, window over → row 6; another agent → denied; closed request → denied', async () => {
      const cc = who('call_center');
      const open = await facts({ created_at: days(-30), assignee_id: randomUUID(), open_correction_requester_ids: [cc.employeeId] });
      expect(await both(engineWith(), cc, 'business.read', open)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R6_OPEN_CORRECTION' });
      expect(await both(engineWith(), cc, 'business.list', open)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(engineWith(), who('call_center'), 'business.read', open)).toEqual({ allowed: false, reason: 'permission_denied' });
      const closed = await facts({ created_at: days(-30), assignee_id: randomUUID() });
      expect(await both(engineWith(), cc, 'business.read', closed)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    it('Developer requester → row 6; the row can be switched off', async () => {
      const dv = who('developer');
      const id = await facts({ created_at: days(-30), open_correction_requester_ids: [dv.employeeId] });
      expect(await both(engineWith(), dv, 'business.read', id)).toEqual({ allowed: true, level: 'context_limited', exceptionRow: 'R6_OPEN_CORRECTION' });
      expect(await both(engineWith({ 'visibility.dec002Rows': ['R1', 'R2', 'R3', 'R4', 'R5'] }), dv, 'business.read', id)).toEqual({ allowed: false, reason: 'permission_denied' });
    });
  });

  describe('D9/D20 archiving recomputes access', () => {
    it('archived: not found for every non-Owner (window or exception notwithstanding); the Owner still reads it', async () => {
      const cc = who('call_center');
      const dv = who('developer');
      const id = await facts({
        created_at: days(-1),
        archived_at: days(0),
        assignee_id: cc.employeeId,
        deal_stage: 'closed',
        project_id: randomUUID(),
        project_status: 'in_progress',
        open_correction_requester_ids: [dv.employeeId],
      });
      expect(await both(engineWith(), who('data_entry'), 'business.read', id)).toEqual({ allowed: false, reason: 'not_found' });
      expect(await both(engineWith(), cc, 'business.read', id)).toEqual({ allowed: false, reason: 'not_found' });
      for (const action of ['deal.read', 'meeting.read', 'project.read', 'follow_up.read'] as Action[]) {
        expect(await both(engineWith(), dv, action, id), action).toEqual({ allowed: false, reason: 'not_found' });
      }
      expect(await both(engineWith(), who('owner'), 'business.read', id)).toEqual({ allowed: true, level: 'owner' });
    });
  });

  describe('Owner', () => {
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

  describe('real view (migrations 200 + 992) on businesses', () => {
    let creator: string;
    let owner: string;
    let agentA: string;
    let agentB: string;
    let visibleId: string;
    let hiddenId: string;
    const tag = `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const emp = async (role: Role) => {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'Access Test', $2, true) RETURNING id`,
        [`${tag}.${role}.${randomUUID().slice(0, 6)}@test.local`, role]
      );
      return rows[0].id;
    };
    const biz = async (createdAt: Date, name = `${tag} business`) => {
      const { rows } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by, created_at) VALUES ($1, $2, $3) RETURNING id`, [name, creator, createdAt]);
      return rows[0].id;
    };

    beforeAll(async () => {
      creator = await emp('data_entry');
      owner = await emp('owner');
      agentA = await emp('call_center');
      agentB = await emp('call_center');
      visibleId = await biz(days(-1));
      hiddenId = await biz(days(-16));
    });

    it('check: Data Entry full on day 1, hidden after 15 elapsed days; Call Center not assigned → permission denied', async () => {
      const e = engineWith();
      const de = who('data_entry', creator);
      expect(await both(e, de, 'business.read', visibleId, 'businesses', 'id', pool)).toEqual({ allowed: true, level: 'full' });
      expect(await both(e, de, 'business.read', hiddenId, 'businesses', 'id', pool)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
      expect(await both(e, who('call_center'), 'business.read', visibleId, 'businesses', 'id', pool)).toEqual({ allowed: false, reason: 'permission_denied' });
    });

    it('assignment window + reassignment on the real view: the new agent starts a window, the old one loses access', async () => {
      const id = await biz(days(-40), `${tag} assigned`);
      await query(`INSERT INTO calling_assignments (business_id, assignee_id, started_at) VALUES ($1, $2, $3)`, [id, agentA, days(-3)]);
      const e = engineWith();
      expect(await both(e, who('call_center', agentA), 'business.read', id, 'businesses', 'id', pool)).toEqual({ allowed: true, level: 'full' });
      await query(`UPDATE calling_assignments SET ended_at = $2, end_reason = 'reassigned' WHERE business_id = $1 AND ended_at IS NULL`, [id, days(-1)]);
      await query(`INSERT INTO calling_assignments (business_id, assignee_id, started_at) VALUES ($1, $2, $3)`, [id, agentB, days(-1)]);
      expect(await both(e, who('call_center', agentA), 'business.read', id, 'businesses', 'id', pool)).toEqual({ allowed: false, reason: 'permission_denied' });
      expect(await both(e, who('call_center', agentB), 'business.read', id, 'businesses', 'id', pool)).toEqual({ allowed: true, level: 'full' });
      // 16 elapsed days after B's assignment: hidden for B too.
      expect(await both(engineWith({}, days(15)), who('call_center', agentB), 'business.read', id, 'businesses', 'id', pool)).toEqual({ allowed: false, reason: 'hidden_by_policy' });
    });

    it('open correction requester ids come from the real requests (submitted / in_review only)', async () => {
      const id = await biz(days(-40), `${tag} corr`);
      await query(
        `INSERT INTO data_correction_requests (business_id, requested_by, issue_type, description) VALUES ($1, $2, 'Wrong phone', 'x')`,
        [id, agentA]
      );
      const e = engineWith();
      expect(await both(e, who('call_center', agentA), 'business.read', id, 'businesses', 'id', pool)).toEqual({
        allowed: true,
        level: 'context_limited',
        exceptionRow: 'R6_OPEN_CORRECTION',
      });
      await query(`UPDATE data_correction_requests SET status = 'withdrawn' WHERE business_id = $1`, [id]);
      expect(await both(e, who('call_center', agentA), 'business.read', id, 'businesses', 'id', pool)).toEqual({ allowed: false, reason: 'permission_denied' });
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
      expect(typeof audit).toBe('function');
    });
  });
});
