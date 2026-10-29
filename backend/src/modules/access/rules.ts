/**
 * MOD-access — the ONE rule table (plan.md §5, SM-VISIBILITY-001 VT-1..VT-6). Owner: BE2.
 *
 * Every rule is a SQL boolean fragment over the access-facts view (alias `af`). `check` selects
 * the fragments as columns for one business and decides in JS; `scopeFilter` ANDs/ORs the same
 * fragments into an EXISTS predicate. Both forms are generated here, so they cannot drift.
 *
 * Steps covered: 5 base scope, 6 relation, 7 timer window (DEC-001), 8 exception rows (DEC-002).
 * Step 9 (resource state) belongs to the owning module. Steps 1–4 are middleware.
 */
import type { Role } from '../../middleware/auth.js';
import type { Action, DataScope, ExceptionRow, ResourceType } from '../../shared/access.js';
import type { PolicyFlags } from '../../shared/flags.js';
import type { SqlParams } from '../../shared/sql.js';

/** Fact columns of the access_facts view (migration 900+). The contract tested in access.api.test.ts. */
export const ACCESS_FACT_COLUMNS = [
  'business_id',
  'created_by',
  'created_at',
  'archived_at',
  'last_touchpoint_at',
  'assignee_id',
  'open_follow_up_responsible_id',
  'open_follow_up_at',
  'deal_id',
  'deal_stage',
  'deal_developer_ids',
  'project_id',
  'project_status',
  'project_developer_ids',
  'project_completed_at',
  'has_open_correction',
  // Revision 5 (migration 992, approved D9): appended at the end.
  'assignment_started_at',
  'open_correction_requester_ids',
] as const;

import { config, ConfigError } from '../../config/index.js';

/** Stage / status literals the view exposes (BE4 maps its enums to these in the view revision). */
export const DEAL_STAGE_ACCEPTED = 'accepted_opportunity';
export const DEAL_STAGE_CLOSED = 'closed';
export const PROJECT_STATUS_COMPLETED = 'completed';
/** Migration 988 (BE4, D17): a cancelled project is never active (no R2/R3 access after cancellation). */
export const PROJECT_STATUS_CANCELLED = 'cancelled';

/** Fail-closed zone used while `company.timezone` is not configured in development/test. Removed in production. */
export const FAIL_CLOSED_TIMEZONE = 'Etc/GMT-14';

let warnedUnsetTimezone = false;
/**
 * The company zone with its fail-closed fallback. Since the approved D9 policy the 15-day window is ELAPSED
 * time (no calendar-day boundary), so the rule table no longer reads it; kept for callers and tests.
 */
export function effectiveTimezone(configured: string | undefined | null): string {
  if (configured && configured.trim()) return configured.trim();
  if (config.isProduction) {
    throw new ConfigError(
      'company.timezone is required in production: no approved IANA company timezone is configured and UTC+14 fallback is removed.'
    );
  }
  if (!warnedUnsetTimezone) {
    warnedUnsetTimezone = true;
    console.warn(
      '[access] company.timezone is NOT CONFIGURED: the 15-day visibility boundary uses Etc/GMT-14 (dev/test fallback only) until configured.'
    );
  }
  return FAIL_CLOSED_TIMEZONE;
}

/**
 * 15-day rule, approved D9 (docs/policy-baseline-2026-10-29.md): 15 ELAPSED days (15 × 24 h). Data Entry from
 * creation; Call Center from the start of the CURRENT assignment (a reassignment starts a new window for the
 * new agent and ends the old one). Edits, calls, notes and other interactions never reset it.
 */
export const VISIBILITY_WINDOW_DAYS = 15;

export const EXCEPTION_ROWS: readonly ExceptionRow[] = [
  'R1_ACCEPTED_OPPORTUNITY',
  'R2_CLOSED_DEAL',
  'R3_ACTIVE_PROJECT',
  'R4_COMPLETED_PROJECT',
  'R5_SCHEDULED_CALLBACK',
  'R6_OPEN_CORRECTION',
];

const ROW_KEY: Record<ExceptionRow, string> = {
  R1_ACCEPTED_OPPORTUNITY: 'R1',
  R2_CLOSED_DEAL: 'R2',
  R3_ACTIVE_PROJECT: 'R3',
  R4_COMPLETED_PROJECT: 'R4',
  R5_SCHEDULED_CALLBACK: 'R5',
  R6_OPEN_CORRECTION: 'R6',
};

/** The flags the rule table reads (plan.md §6, all BE2 except the shared ones). */
export type RuleFlags = Pick<
  PolicyFlags,
  | 'visibility.timerBasis'
  | 'visibility.dec002Rows'
  | 'visibility.callbackGraceHours'
  | 'visibility.completedProjectDays'
  | 'access.dataEntryScope'
  | 'access.auditOwnerHiddenReads'
  | 'auth.ownerPending2faScope'
  | 'deals.developerPreClosure'
  | 'company.timezone'
>;

export interface RuleInput {
  role: Role;
  employeeId: string;
  action: Action;
  resourceType: ResourceType;
  now: Date;
  flags: RuleFlags;
  params: SqlParams;
  /** Alias of the access_facts view inside the generated SQL. */
  af?: string;
  /**
   * Custom (non-matrix) roles only: the `data_scope` of the validated `role_permissions` grant for this
   * action, or `null` when the role holds no grant. The four matrix roles ignore it. Absent = `null`.
   * Fixed v1 scope (approved): custom roles are turned off, so the rule table ignores it for every role.
   */
  dataScope?: DataScope | null;
}

export interface RuleFragments {
  /**
   * D9/D20: archiving recomputes access everywhere. `af.archived_at IS NULL` for every non-Owner role, so the
   * related deals, meetings, projects, follow-ups of an archived business never pass `scopeFilter`; `TRUE`
   * for the Owner.
   */
  live: string;
  /** Step 5. */
  scope: string;
  /** Step 6. */
  relation: string;
  /** Step 7: TRUE while the 15-day window is open (basis per DEC-001). */
  window: string;
  /** Step 8: one fragment per DEC-002 row, FALSE when the row is off or does not apply to this role/surface. */
  rows: Record<ExceptionRow, string>;
}

/**
 * R-06 resource types whose LIST predicate is the business rule (steps 5–8) over `<alias>.business_id`.
 * `notification` is R-06 too, but its inbox list is own-record (recipient) and each item is re-checked
 * against its referenced resource at read time (AR-14) through `checkMany`.
 */
export const BUSINESS_RESOURCE_TYPES: readonly ResourceType[] = [
  'business',
  'call_attempt',
  'follow_up',
  'reservation',
  'deal',
  'meeting',
  'project',
  'task',
  'export_row',
  'duplicate_preview',
];

export function isBusinessResource(type: ResourceType): boolean {
  return BUSINESS_RESOURCE_TYPES.includes(type);
}

/**
 * Surfaces where DEC-002 context-limited items must NOT appear (Table RT rule 4: never in general
 * business search / directory). The only exception: the Developer closed-deal list (row 2) is a list
 * surface (matrix §2.2 row 2 "Closed-deal list only"; §3.4 `business.list` DV = Ctx row 2 list only).
 */
function rowsAllowedFor(action: Action, role: Role): ReadonlySet<ExceptionRow> {
  if (action === 'business.search') return new Set();
  if (action === 'business.list') return role === 'developer' ? new Set<ExceptionRow>(['R2_CLOSED_DEAL']) : new Set();
  return new Set(EXCEPTION_ROWS);
}

/** The four matrix roles (authz-matrix.md header). Every other role id is a custom role. */
export const MATRIX_ROLES: readonly Role[] = ['owner', 'data_entry', 'call_center', 'developer'];

/** Build the step 5–8 fragments for one principal/action. Pure: no I/O. */
export function buildRuleFragments(input: RuleInput): RuleFragments {
  const af = input.af ?? 'af';
  const p = input.params;
  const f = input.flags;
  const role = input.role;
  // Parameters are allocated lazily and typed at the placeholder, so a fragment that is not used
  // never leaves an unreferenced `$n` behind (Postgres rejects those: "could not determine data type").
  const lazy = (value: unknown, cast: string) => {
    let ph: string | undefined;
    return () => (ph ??= `${p.add(value)}::${cast}`);
  };
  const u = lazy(input.employeeId, 'uuid');
  const now = lazy(input.now.toISOString(), 'timestamptz');
  const grace = lazy(f['visibility.callbackGraceHours'], 'int');
  const completedDays = lazy(f['visibility.completedProjectDays'], 'int');

  // Step 7 — approved D9: 15 ELAPSED days. The basis is the creation time for Data Entry (and for the Owner's
  // "hidden from others" flag) and the start of the current assignment for Call Center. The retired DEC-001
  // `inactivity` basis (touchpoints reset the window) is rejected at flag load (shared/flags.ts) and never read.
  const elapsedWindow = (basis: string) => `(${basis} + make_interval(days => ${VISIBILITY_WINDOW_DAYS}) > ${now()})`;
  const creationWindow = () => elapsedWindow(`${af}.created_at`);

  // Step 8 — exception rows, each gated by the CFG list and by the role the matrix names.
  const enabled = new Set(f['visibility.dec002Rows']);
  const allowed = rowsAllowedFor(input.action, role);
  const on = (r: ExceptionRow) => enabled.has(ROW_KEY[r]) && allowed.has(r);
  const devPreClosure = f['deals.developerPreClosure'] === 'assigned';
  const inactiveProject = `('${PROJECT_STATUS_COMPLETED}', '${PROJECT_STATUS_CANCELLED}')`;
  const projectActive = `(${af}.project_id IS NOT NULL AND ${af}.project_status NOT IN ${inactiveProject})`;
  const completedRecently = () =>
    `(${af}.project_status = '${PROJECT_STATUS_COMPLETED}' AND ${af}.project_completed_at + make_interval(days => ${completedDays()}) > ${now()})`;

  const isMatrixRole = MATRIX_ROLES.includes(role);
  const rows: Record<ExceptionRow, string> = {
    // D15: accepted opportunities are the assigned Developer's and the Owner's only. The Call Center agent who
    // accepted the call has no opportunity/deal access through this row.
    R1_ACCEPTED_OPPORTUNITY:
      on('R1_ACCEPTED_OPPORTUNITY') && role === 'developer' && devPreClosure
        ? `(${af}.deal_stage = '${DEAL_STAGE_ACCEPTED}' AND ${u()} = ANY(${af}.deal_developer_ids))`
        : 'FALSE',
    // D9/D15: a closed deal with an ACTIVE project (not completed, not cancelled), or a completed project within
    // 15 elapsed days of completion. A closed deal without a project grants nothing to other Developers; the
    // deal's ASSIGNED Developer keeps it until the project exists (manual provisioning: they create it).
    // A cancelled project is inactive at once (no 15-day tail).
    R2_CLOSED_DEAL:
      on('R2_CLOSED_DEAL') && role === 'developer'
        ? `(${af}.deal_stage = '${DEAL_STAGE_CLOSED}' AND (${projectActive} OR ${completedRecently()} OR (${af}.project_id IS NULL AND ${u()} = ANY(${af}.deal_developer_ids))))`
        : 'FALSE',
    R3_ACTIVE_PROJECT:
      on('R3_ACTIVE_PROJECT') && role === 'developer'
        ? `(${projectActive} AND ${u()} = ANY(${af}.project_developer_ids))`
        : 'FALSE',
    R4_COMPLETED_PROJECT:
      on('R4_COMPLETED_PROJECT') && role === 'developer'
        ? `(${completedRecently()} AND ${u()} = ANY(${af}.project_developer_ids))`
        : 'FALSE',
    // D9: callback time + 48 h, for the CURRENTLY assigned agent only (no former-assignee leftovers).
    R5_SCHEDULED_CALLBACK:
      on('R5_SCHEDULED_CALLBACK') && role === 'call_center'
        ? `(${af}.assignee_id = ${u()} AND ${af}.open_follow_up_responsible_id = ${u()} AND ${af}.open_follow_up_at + make_interval(hours => ${grace()}) > ${now()})`
        : 'FALSE',
    // D9: the correction requester (any matrix role) keeps context access while the request is open. Data Entry
    // also reaches every open request as the reviewing role (role permission, not an exception for the person).
    R6_OPEN_CORRECTION: !on('R6_OPEN_CORRECTION') || !isMatrixRole || role === 'owner'
      ? 'FALSE'
      : role === 'data_entry'
        ? `(${af}.has_open_correction OR ${u()} = ANY(${af}.open_correction_requester_ids))`
        : `(${u()} = ANY(${af}.open_correction_requester_ids))`,
  };

  // Steps 5–6 per role (VT-2).
  let scope = 'FALSE';
  let relation = 'FALSE';
  let windowForRole = 'FALSE';
  const withRequester = (base: string) => (rows.R6_OPEN_CORRECTION !== 'FALSE' ? `(${base} OR ${rows.R6_OPEN_CORRECTION})` : `(${base})`);
  switch (role) {
    case 'data_entry':
      scope = f['access.dataEntryScope'] === 'DE-2' ? `(${af}.created_by = ${u()} OR ${af}.has_open_correction)` : 'TRUE';
      relation = 'TRUE';
      windowForRole = creationWindow();
      break;
    case 'call_center':
      // Matrix §2.3: base scope = businesses CURRENTLY assigned. Row 5 already requires the current assignment;
      // a former assignee keeps nothing (D9), except an open correction request of their own (row 6).
      scope = 'TRUE';
      relation = withRequester(`${af}.assignee_id = ${u()}`);
      windowForRole = `(${af}.assignee_id = ${u()} AND ${elapsedWindow(`${af}.assignment_started_at`)})`;
      break;
    case 'developer': {
      // Matrix §2.3: a Developer's relation is the context rows only (R1 assigned accepted opportunity, R2 closed
      // deal with an active project, R3/R4 assigned project, R6 own open correction request). There is NO
      // base-scope window: the 15-day window never grants a Developer `full` access (D15: no directory browsing).
      scope = 'TRUE';
      const devRows = (['R1_ACCEPTED_OPPORTUNITY', 'R2_CLOSED_DEAL', 'R3_ACTIVE_PROJECT', 'R4_COMPLETED_PROJECT', 'R6_OPEN_CORRECTION'] as const)
        .map((r) => rows[r])
        .filter((s) => s !== 'FALSE');
      relation = devRows.length ? `(${devRows.join(' OR ')})` : 'FALSE';
      windowForRole = 'FALSE';
      break;
    }
    case 'owner':
      // The engine answers Owners before steps 5–8 (R-01); it reads only `window` here, to flag a record
      // that is hidden for everyone else (OI-05 `ownerViewedHidden`, `hiddenForOthersPredicate`).
      scope = 'TRUE';
      relation = 'TRUE';
      windowForRole = creationWindow();
      break;
    default:
      // Fixed v1 scope (approved): four roles, no custom roles. Any other role id gets nothing, on every
      // surface, whatever `role_permissions` says (the data is kept, the feature is off).
      break;
  }

  return { live: role === 'owner' ? 'TRUE' : `${af}.archived_at IS NULL`, scope, relation, window: windowForRole, rows };
}

/** `live AND scope AND relation AND (window OR any row)` — the list predicate over `af`. */
export function combinedPredicate(fr: RuleFragments): string {
  const grants = [fr.window, ...EXCEPTION_ROWS.map((r) => fr.rows[r])].filter((s) => s !== 'FALSE');
  const granted = grants.length ? `(${grants.join(' OR ')})` : 'FALSE';
  return `(${fr.live} AND ${fr.scope} AND ${fr.relation} AND ${granted})`;
}
