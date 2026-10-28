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
] as const;

import { config, ConfigError } from '../../config/index.js';

/** Stage / status literals the view exposes (BE4 maps its enums to these in the view revision). */
export const DEAL_STAGE_ACCEPTED = 'accepted_opportunity';
export const DEAL_STAGE_CLOSED = 'closed';
export const PROJECT_STATUS_COMPLETED = 'completed';

/** Fail-closed zone used while `company.timezone` is not configured in development/test. Removed in production. */
export const FAIL_CLOSED_TIMEZONE = 'Etc/GMT-14';

let warnedUnsetTimezone = false;
/** The zone the day-16 boundary uses. In production, an approved IANA company timezone is required. */
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

/** 15-day rule (Confirmed C1): hidden from 00:00 company time on created-date + 15 (OI-04). */
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
   */
  dataScope?: DataScope | null;
}

export interface RuleFragments {
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
  // R4 (security review): an unset company timezone (NEEDS VALUE) must not mean "open". Fail closed with
  // the earliest zone (UTC+14, POSIX name Etc/GMT-14): the day-16 boundary is reached first everywhere.
  const tz = lazy(effectiveTimezone(f['company.timezone']), 'text');
  const grace = lazy(f['visibility.callbackGraceHours'], 'int');
  const completedDays = lazy(f['visibility.completedProjectDays'], 'int');

  // Step 7 — timer basis (DEC-001 FLAG: both branches).
  const basis =
    f['visibility.timerBasis'] === 'inactivity'
      ? `GREATEST(${af}.created_at, COALESCE(${af}.last_touchpoint_at, ${af}.created_at))`
      : `${af}.created_at`;
  const window = () => `((timezone(${tz()}, ${basis})::date + ${VISIBILITY_WINDOW_DAYS}) > timezone(${tz()}, ${now()})::date)`;

  // Step 8 — DEC-002 rows, each gated by the CFG list and by the role the matrix names.
  const enabled = new Set(f['visibility.dec002Rows']);
  const allowed = rowsAllowedFor(input.action, role);
  const on = (r: ExceptionRow) => enabled.has(ROW_KEY[r]) && allowed.has(r);
  const devPreClosure = f['deals.developerPreClosure'] === 'assigned';

  const r1Who = (): string =>
    role === 'call_center'
      ? `${af}.assignee_id = ${u()}`
      : role === 'developer' && devPreClosure
        ? `${u()} = ANY(${af}.deal_developer_ids)`
        : 'FALSE';
  const rows: Record<ExceptionRow, string> = {
    R1_ACCEPTED_OPPORTUNITY:
      on('R1_ACCEPTED_OPPORTUNITY') && r1Who() !== 'FALSE'
        ? `(${af}.deal_stage = '${DEAL_STAGE_ACCEPTED}' AND ${r1Who()})`
        : 'FALSE',
    R2_CLOSED_DEAL:
      on('R2_CLOSED_DEAL') && role === 'developer'
        ? `(${af}.deal_stage = '${DEAL_STAGE_CLOSED}' AND (${af}.project_completed_at IS NULL OR ${af}.project_completed_at + make_interval(days => ${completedDays()}) > ${now()}))`
        : 'FALSE',
    R3_ACTIVE_PROJECT:
      on('R3_ACTIVE_PROJECT') && role === 'developer'
        ? `(${af}.project_id IS NOT NULL AND ${af}.project_status IS DISTINCT FROM '${PROJECT_STATUS_COMPLETED}' AND ${u()} = ANY(${af}.project_developer_ids))`
        : 'FALSE',
    R4_COMPLETED_PROJECT:
      on('R4_COMPLETED_PROJECT') && role === 'developer'
        ? `(${af}.project_status = '${PROJECT_STATUS_COMPLETED}' AND ${af}.project_completed_at + make_interval(days => ${completedDays()}) > ${now()} AND ${u()} = ANY(${af}.project_developer_ids))`
        : 'FALSE',
    R5_SCHEDULED_CALLBACK:
      on('R5_SCHEDULED_CALLBACK') && role === 'call_center'
        ? `(${af}.open_follow_up_responsible_id = ${u()} AND ${af}.open_follow_up_at + make_interval(hours => ${grace()}) > ${now()})`
        : 'FALSE',
    R6_OPEN_CORRECTION: on('R6_OPEN_CORRECTION') && role === 'data_entry' ? `(${af}.has_open_correction)` : 'FALSE',
  };

  // Steps 5–6 per role (VT-2).
  let scope = 'FALSE';
  let relation = 'FALSE';
  let windowForRole = 'FALSE';
  switch (role) {
    case 'data_entry':
      scope = f['access.dataEntryScope'] === 'DE-2' ? `(${af}.created_by = ${u()} OR ${af}.has_open_correction)` : 'TRUE';
      relation = 'TRUE';
      windowForRole = window();
      break;
    case 'call_center':
      // Matrix §2.3: base scope = businesses CURRENTLY assigned. Follow-up responsibility alone is row 5
      // (context-limited), never `full` (security review R1): the window only grants to the assignee.
      scope = 'TRUE';
      relation =
        rows.R5_SCHEDULED_CALLBACK !== 'FALSE'
          ? `(${af}.assignee_id = ${u()} OR ${rows.R5_SCHEDULED_CALLBACK})`
          : `(${af}.assignee_id = ${u()})`;
      windowForRole = `(${af}.assignee_id = ${u()} AND ${window()})`;
      break;
    case 'developer': {
      // Matrix §2.3: a Developer's relation is the DEC-002 context rows only (R1 assigned pre-closure deal
      // under DEC-005 `assigned`, R2 closed deal, R3/R4 assigned project). There is NO base-scope window:
      // the 15-day window never grants a Developer `full` access to a business (§3.4 DV = Ctx rows 1–4).
      scope = 'TRUE';
      const devRows = (['R1_ACCEPTED_OPPORTUNITY', 'R2_CLOSED_DEAL', 'R3_ACTIVE_PROJECT', 'R4_COMPLETED_PROJECT'] as const)
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
      windowForRole = window();
      break;
    default: {
      // Custom roles (migration 014): nothing by default. A validated `role_permissions` grant for THIS
      // action opens the base scope per its `data_scope`; the 15-day window still applies (§2.1 "every
      // non-Owner role") and the DEC-002 rows never do (they are role-specific to the matrix roles).
      const ds = input.dataScope ?? null;
      if (!ds) break;
      scope = 'TRUE';
      relation =
        ds === 'global'
          ? 'TRUE'
          : ds === 'assigned_only'
            ? `(${af}.assignee_id = ${u()} OR ${u()} = ANY(${af}.deal_developer_ids) OR ${u()} = ANY(${af}.project_developer_ids))`
            : // `self` (and `department`, which has no business-level fact: narrowest reading) = own-created.
              `(${af}.created_by = ${u()})`;
      windowForRole = window();
      break;
    }
  }

  return { scope, relation, window: windowForRole, rows };
}

/** `scope AND relation AND (window OR any row)` — the list predicate over `af`. */
export function combinedPredicate(fr: RuleFragments): string {
  const grants = [fr.window, ...EXCEPTION_ROWS.map((r) => fr.rows[r])].filter((s) => s !== 'FALSE');
  const granted = grants.length ? `(${grants.join(' OR ')})` : 'FALSE';
  return `(${fr.scope} AND ${fr.relation} AND ${granted})`;
}
