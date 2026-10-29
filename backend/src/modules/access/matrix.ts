/**
 * MOD-access — VT-3 declarations harness. Owner: BE2.
 *
 * `AUTHZ_MATRIX` mirrors docs/security/authz-matrix.md §3 (role × action), one row per action.
 * Modules declare their actions FROM this table (`matrixPolicy(action)`) so a declaration cannot
 * drift from the contract, and `verifyDeclaredActions()` (run in access init, after every module
 * has imported its schemas) fails startup when a declared action's roles differ from the matrix.
 *
 * "Own" / "Asg" / "Ctx" rows are role-allowed here (step 4); the resource relation is the engine's
 * job (`access.check` / `scopeFilter`, steps 5–8) and the owning module's (step 9).
 * Public auth routes and the actions allowed while an Owner is pending 2FA are NOT declared here:
 * identity's own middleware handles them (matrix §3.1).
 */
import type { Role } from '../../middleware/auth.js';
import { defineActions, getActionPolicy, registerGrantableActions, type Action, type ActionPolicy } from '../../shared/access.js';

const O: Role = 'owner';
const DE: Role = 'data_entry';
const CC: Role = 'call_center';
const DV: Role = 'developer';
const ALL: readonly Role[] = [O, DE, CC, DV];

export interface MatrixRow {
  roles: readonly Role[];
  /** Owner-only admin action: completed 2FA required under both R-11 readings. */
  admin?: boolean;
  /**
   * Matrix §3.11: a privileged (admin) row a CUSTOM role may be granted. The holder still needs a
   * verified second factor to execute it. Rows without the marker are never grantable.
   */
  grantable?: boolean;
  /** Matrix section, for reports. */
  section: string;
  /** Matrix note (DEMO flags etc.). */
  note?: string;
}

const row = (section: string, roles: readonly Role[], note?: string, admin?: boolean): MatrixRow => ({
  section,
  roles,
  ...(note ? { note } : {}),
  ...(admin ? { admin: true } : {}),
});

/** An admin row that §3.11 lets a custom role hold (review/read work an HR-type role needs; no escalation). */
const grantableRow = (section: string, note?: string): MatrixRow => ({ ...row(section, [O], note, true), grantable: true });

/** authz-matrix.md §3 as data. Keys are the matrix action names. */
export const AUTHZ_MATRIX: Readonly<Record<string, MatrixRow>> = Object.freeze({
  // §3.1 identity (routes allowed while pending 2FA are identity-middleware only; not listed)
  'auth.password_reset.assist': row('3.1', [O], 'Owner never sees a password', true),
  'session.revoke': row('3.1', [O], 'Audited session.revoked', true),
  'auth.session.revoke_all': row('3.1', ALL, 'Own sessions only (CR1-03); BL-06'),
  'auth.password.change': row('3.1', ALL, 'Own; current password required; ends other sessions (V-01)'),
  'employee.issue_2fa_enrollment_token': row('3.1', [O], 'AU-8 enrollment token for another Owner; BL-06', true),
  'employee.manage_own_recovery_codes': row('3.1', [O], 'AU-9 own recovery codes, step-up TOTP; BL-06', true),

  // §3.2 employees and profile
  'employee.list': grantableRow('3.2', 'Directory is Owner only; §3.11 grantable (read)'),
  'employee.read': grantableRow('3.2', '§3.11 grantable (read)'),
  'employee.create': row('3.2', [O], undefined, true),
  'employee.update': row('3.2', [O], 'Role change ends sessions', true),
  'employee.deactivate': row('3.2', [O], 'Not self; not the last active Owner', true),
  'employee.activate': row('3.2', [O], 'DEMO OQ-14', true),
  'employee.read_open_items': grantableRow('3.2', 'OWN-003 open-work impact; BL-06 (BE1-R4); §3.11 grantable (read)'),
  'profile.read': row('3.2', ALL, 'Own'),
  'profile.update': row('3.2', ALL, 'Own; DEMO OQ-13'),
  'role.list': row('3.2', [O], 'List system and custom roles', true),
  'role.read': row('3.2', [O], 'Read role details and permissions', true),
  'role.create': row('3.2', [], 'Fixed v1 scope (approved 2026-10-29): no custom-role management'),
  'role.update': row('3.2', [], 'Fixed v1 scope (approved 2026-10-29): no custom-role management'),
  'role.delete': row('3.2', [], 'Fixed v1 scope (approved 2026-10-29): no custom-role management'),
  'permission.list': row('3.2', [O], 'List available system permissions', true),

  // §3.3 attendance
  'attendance.check_in': row('3.3', ALL, 'Own; no Owner exemption (F-04)'),
  'attendance.check_out': row('3.3', ALL, 'Own'),
  'attendance.read': row('3.3', ALL, 'Owner all, others own'),
  'attendance.correction.request': row('3.3', ALL, 'Own; DEMO attendance.employeeRequests'),
  'attendance.correction.review': grantableRow('3.3', '§3.11 grantable'),
  'attendance.adjust': grantableRow('3.3', 'Reason required; DEMO N-2; §3.11 grantable'),
  'attendance.retroactive_create': grantableRow('3.3', 'Reason required; §3.11 grantable'),
  'attendance.remote_exception.grant': grantableRow('3.3', 'DEMO DEC-010; §3.11 grantable'),
  'attendance.failed_checkout.review': grantableRow('3.3', 'DEMO attendance.failedCheckout; §3.11 grantable'),
  'attendance.overview.read': grantableRow('3.3', 'OWN-004 monitoring; BL-06 (BE1-R4); §3.11 grantable (read)'),
  'attendance.remote_exception.request': row('3.3', ALL, 'Own; DEMO DEC-010 attendance.remoteSelfRequest; BL-06 (BE1-R4)'),
  // Owner decision 2026-10-29 (supersedes DEC-033 "no break tracking"): breaks are back, grants as before
  // (a959fef). The CFG flag attendance.breaksEnabled can still switch the routes off (404).
  'attendance.break.start': row('3.3', ALL, 'Own; start attendance break'),
  'attendance.break.end': row('3.3', ALL, 'Own; end attendance break'),
  'attendance.break.read': row('3.3', ALL, 'Owner all, others own'),
  'attendance.days_off.manage': row('3.3', [O], 'D1 approved employee days off (create/list/cancel)', true),

  // §3.4 business directory
  'business.list': row('3.4', ALL, 'scopeFilter; CC Asg; DV Ctx row 2 list only'),
  'business.search': row('3.4', ALL, 'scopeFilter; hidden rows omitted and not counted'),
  'business.read': row('3.4', ALL, 'DE §2.1–2.2; CC Asg (+ rows 1, 5); DV Ctx (rows 1–4)'),
  'business.create': row('3.4', [O, DE], 'Duplicate block is mandatory'),
  'business.duplicate_check': row('3.4', [O, DE], 'Rate-limited; DEMO DEC-003 (i), DEC-013'),
  'business.duplicate_review_request': row('3.4', [DE], 'D10 Request Owner review of a blocking duplicate; audited; grants no access'),
  'business.update': row('3.4', [O, DE], 'Version check; DE Ctx row 6 apply only'),
  'business.archive': row('3.4', [O], 'DEMO C-01', true),
  'business.restore': row('3.4', [O], 'DEMO C-01', true),
  'business.delete': row('3.4', [], 'No hard delete in v1 (C-01)'),
  'business.history.read': row('3.4', ALL, 'If the business check passes; OI-11'),
  'business.read_hidden': row('3.4', [O], 'Audited; DEMO OI-05', true),

  // §3.5 categories
  'category.list': row('3.5', ALL, 'Active categories only for non-Owners'),
  'category.create': row('3.5', [O], 'DEMO DEC-015', true),
  'category.rename': row('3.5', [O], 'DEMO DEC-015', true),
  'category.deactivate': row('3.5', [O], 'Deactivate only (CR-1)', true),

  // §3.6 data-correction requests
  'correction.submit': row('3.6', [O, CC, DV], 'Business check passes; DE edits directly (OI-24)'),
  'correction.read': row('3.6', ALL, 'DE queue (row 6); CC/DV own'),
  'correction.withdraw': row('3.6', [O, CC, DV], 'Own; only before In review'),
  'correction.review': row('3.6', [O, DE]),
  'correction.apply': row('3.6', [O, DE], 'The only Ctx master-data edit (row 6)'),
  'correction.reject': row('3.6', [O, DE], 'Reason required (OI-19)'),
  'correction.close': row('3.6', [O, DE]),

  // §3.7 calling
  'calling.queue.read': row('3.7', [O, CC], 'CC own queue (Asg)'),
  'calling.assign': row('3.7', [O], 'WF-CALL-001 (B8)', true),
  'calling.reassign': row('3.7', [O], undefined, true),
  'calling.unassign': row('3.7', [O], undefined, true),
  'calling.autofill': row('3.7', [O], 'DEMO DEC-021', true),
  'reservation.acquire': row('3.7', [O, CC], 'CC Asg (B7); not on Rejected'),
  'reservation.renew': row('3.7', [O, CC], 'Lease token validated'),
  'reservation.release': row('3.7', [O, CC]),
  'reservation.override': row('3.7', [O], 'Reason required; DEMO B3-Q14', true),
  'call.log_attempt': row('3.7', [O, CC], 'Asg + reservation holder'),
  'call.set_outcome': row('3.7', [O, CC], 'Asg + reservation holder'),
  'business.reopen_rejected': row('3.7', [O], 'Reason required; DEMO DEC-016', true),
  'business.requeue': row('3.7', [O], 'DEMO B3-Q12', true),
  'follow_up.create': row('3.7', [O, CC], 'Asg or responsible (row 5)'),
  'follow_up.reschedule': row('3.7', [O, CC]),
  'follow_up.complete': row('3.7', [O, CC]),
  'follow_up.cancel': row('3.7', [O, CC]),
  'follow_up.read': row('3.7', [O, CC], 'Own responsibility'),
  'call_attempt.list_do_not_call': row('3.7', [O, CC], 'CC-008; CC Asg (scopeFilter); BL-06 (BE3-R5)'),
  'call_attempt.list_opportunities': row('3.7', [O], 'CC-007; D15 (approved): accepted opportunities are the assigned Developer and the Owner only'),

  // §3.8 deals, meetings, projects, tasks
  'deal.read': row('3.8', [O, DV], 'D15 (approved): assigned Developer + Owner only; CC has no deal access'),
  'deal.list_closed': row('3.8', [O, DV], 'Company-wide, row 2'),
  'deal.assign_developer': row('3.8', [O, CC], 'Row 1 (E2)'),
  'deal.update_stage': row('3.8', [O, DV], 'Assigned DV; DEMO OQ-03'),
  'deal.record_signature': row('3.8', [O, DV], 'DEMO DEC-005'),
  'deal.record_payment': row('3.8', [O, DV], 'DEMO DEC-005'),
  'deal.request_closure_verification': row('3.8', [DV], 'DEMO deals.closureMode = ownerVerify'),
  'deal.verify_closure': row('3.8', [O], 'DEMO DEC-006 (direct: assigned DV)', true),
  'deal.finalize': row('3.8', [O], 'DEMO DEC-006', true),
  'deal.reject_closure': row('3.8', [O], 'DEMO DEC-006', true),
  'deal.mark_not_proceeding': row('3.8', [O, DV], 'Reason required'),
  'deal.reopen_not_proceeding': row('3.8', [O], 'Reason required; DEMO OQ-15', true),
  'meeting.create': row('3.8', [O, CC, DV], 'CC row 1; DV assigned'),
  'meeting.reschedule': row('3.8', [O, CC, DV]),
  'meeting.mark_missed': row('3.8', [O, CC, DV], 'DEMO R-13'),
  'meeting.complete': row('3.8', [O, CC, DV]),
  'meeting.read': row('3.8', [O, CC, DV], 'Through the deal check (OI-29)'),
  'project.read': row('3.8', [O, DV], 'Assigned DV (rows 3, 4)'),
  'project.board.read': row('3.8', [O, DV]),
  'project.update_status': row('3.8', [O, DV], 'DEMO DEC-019'),
  'project.assign_developers': row('3.8', [O], 'DEMO OQ-08', true),
  'project.reopen_completed': row('3.8', [O], 'Reason required; DEMO OQ-15', true),
  'project.provision_retry': row('3.8', [O], 'F3', true),
  'task.create': row('3.8', [O, DV], 'DEMO OQ-06'),
  'task.update': row('3.8', [O, DV]),
  'task.complete': row('3.8', [O, DV]),

  // §3.9 targets, settings, notifications
  'target.set': row('3.9', [O], 'DEMO DEC-020, DEC-025', true),
  'target.read': row('3.9', ALL, 'Owner all, others own'),
  'work_item.read': row('3.9', ALL, 'Owner all, others own (assignee); R2-03'),
  'work_item.create': row('3.9', [O], 'Owner assigns work; R2-03', true),
  'work_item.update': row('3.9', ALL, 'Owner any; others own (assignee) only, 404 otherwise; R2-03'),
  'settings.read': row('3.9', [O], 'Non-Owners get derived values elsewhere', true),
  'settings.read_public': row('3.9', ALL, 'Derived company values only (R3); BL-06 (BE1-R4)'),
  'settings.update': row('3.9', [O], 'Audited settings.updated', true),
  'notification.list': row('3.9', ALL, 'Own; re-checked at read time (AR-14)'),
  'notification.mark_read': row('3.9', ALL, 'Own'),
  'reminder.monitor.read': row('3.9', [O], 'DEMO AR-13', true),
  'reminder.send_again': row('3.9', [O], 'DEMO AR-13', true),

  // §3.10 reports, export, audit
  'dashboard.owner.read': row('3.10', [O], undefined, true),
  'report.read': row('3.10', [O], undefined, true),
  'dashboard.self.read': row('3.10', ALL, 'Own metrics only'),
  'report.export': row('3.10', [O], 'Step-up TOTP ≤ 10 min; per-row check', true),
  'audit.read': row('3.10', [O], 'Viewing not audited (DEMO OQ-18)', true),
  'audit.export': row('3.10', [], 'Not in v1 (DEMO OQ-18)'),
  'audit.update': row('3.10', [], 'Impossible by design'),
  'audit.delete': row('3.10', [], 'Impossible by design'),
});

export type MatrixAction = keyof typeof AUTHZ_MATRIX;

// §3.11: the matrix, not a module's declaration, says which privileged rows a custom role may hold
// (some modules declare their privileged rows inline, without `matrixPolicy`).
registerGrantableActions(
  Object.entries(AUTHZ_MATRIX)
    .filter(([, m]) => m.grantable)
    .map(([a]) => a as Action)
);

/** The policy a module must declare for a matrix action. Throws for an action not in the matrix. */
export function matrixPolicy(action: string): ActionPolicy {
  const m = AUTHZ_MATRIX[action];
  if (!m) throw new Error(`Action "${action}" is not in docs/security/authz-matrix.md; post a REQUEST to the Security Lead`);
  return {
    roles: m.roles,
    ...(m.admin ? { admin: true } : {}),
    ...(m.grantable ? { grantable: true } : {}),
    ...(m.note ? { description: m.note } : {}),
  };
}

/** Privileged matrix row (admin, Owner-only or nobody): never grantable to a custom role unless marked. */
export function isPrivilegedMatrixRow(m: MatrixRow): boolean {
  return Boolean(m.admin) || m.roles.length === 0 || (m.roles.length === 1 && m.roles[0] === O);
}

/**
 * Why a matrix action cannot be granted to a custom role, or `undefined` when it can.
 * Rules (§3.11): the action must exist in the matrix; nobody-rows are never grantable; privileged
 * rows only when marked `grantable`.
 */
export function grantRefusal(action: string): string | undefined {
  const m = AUTHZ_MATRIX[action];
  if (!m) return `"${action}" is not an action in the authorization matrix.`;
  if (m.roles.length === 0) return `"${action}" is allowed to nobody and cannot be granted.`;
  if (isPrivilegedMatrixRow(m) && !m.grantable) return `"${action}" is an Owner-only administrative action and cannot be granted to a custom role.`;
  return undefined;
}

/**
 * Declare several matrix actions at once (each module calls this once in its schemas.ts).
 * The matrix names do not all fit the shared `Action` template (e.g. `auth.*`, `calling.*`), so the
 * cast is deliberate: the matrix document is the contract for names.
 */
export function defineMatrixActions<const K extends readonly string[]>(actions: K): Record<K[number], ActionPolicy> {
  const policies: Record<string, ActionPolicy> = {};
  for (const a of actions) policies[a] = matrixPolicy(a);
  defineActions(policies as Partial<Record<Action, ActionPolicy>>);
  return policies as Record<K[number], ActionPolicy>;
}

export interface MatrixDrift {
  action: string;
  problem: 'not_in_matrix' | 'roles_differ' | 'admin_differs';
}

/** Compare one registered action against the matrix. `undefined` = matches. */
export function driftFor(action: string): MatrixDrift | undefined {
  const declared = getActionPolicy(action as Action);
  if (!declared) return undefined;
  const expected = AUTHZ_MATRIX[action];
  if (!expected) return { action, problem: 'not_in_matrix' };
  const a = [...declared.roles].sort().join(',');
  const b = [...expected.roles].sort().join(',');
  if (a !== b) return { action, problem: 'roles_differ' };
  if (Boolean(declared.admin) !== Boolean(expected.admin)) return { action, problem: 'admin_differs' };
  return undefined;
}

/**
 * Startup self-test (access module init). A declared action whose roles differ from the matrix is a
 * security bug: throw. An action unknown to the matrix is reported (console.error) so the Security
 * Lead can add the row; it stays usable because `requireAction` already treats it per its declaration.
 */
export function verifyDeclaredActions(actions: Iterable<string>): MatrixDrift[] {
  const drifts: MatrixDrift[] = [];
  for (const action of actions) {
    const d = driftFor(action);
    if (d) drifts.push(d);
  }
  const fatal = drifts.filter((d) => d.problem !== 'not_in_matrix');
  for (const d of drifts.filter((d) => d.problem === 'not_in_matrix')) {
    console.error('Access: declared action is not in the authz matrix', d);
  }
  if (fatal.length > 0) {
    throw new Error(
      `Access: declared actions drift from docs/security/authz-matrix.md: ${fatal.map((d) => `${d.action} (${d.problem})`).join(', ')}`
    );
  }
  return drifts;
}
