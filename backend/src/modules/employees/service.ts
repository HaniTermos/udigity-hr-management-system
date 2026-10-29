/**
 * MOD-employees — service (rules + public operations for other modules). Owner: BE1.
 * Commands run in one transaction with their audit rows and outbox events (plan §4.6):
 *   create  → account.created (E-01) + credential-setup token (identity)
 *   update  → employee.updated; role change → account.role_changed (E-02)
 *   status  → account.deactivated (E-02) / account.activated
 */
import type { Queryable } from '../../db/pool.js';
import type { Role } from '../../middleware/auth.js';
import { HttpError, isHttpError } from '../../shared/errors.js';
import { outbox } from '../../shared/outbox.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import { openItemsFor as callsOpenItemsFor, openFollowUpCounts } from '../calls/service.js';
import { openItemsFor as dealsOpenItemsFor, openItemsForMany as dealsOpenItemsForMany } from '../deals/service.js';
import { openItemsFor as projectsOpenItemsFor, openItemsForMany as projectsOpenItemsForMany } from '../projects/service.js';
import { invalidateCredentialsForReactivation, issueCredentialSetup, securitySummaries } from '../identity/service.js';
import { openWorkFor as attendanceOpenWork } from '../attendance/service.js';
import * as repo from './repo.js';
import { ROLES } from './schemas.js';
import type {
  CreateEmployeeInput,
  EmployeeDto,
  EmployeeListQuery,
  EmployeeRowDto,
  OpenItemCounts,
  UpdateEmployeeInput,
} from './schemas.js';

const actorId = (ctx: CommandContext) => (ctx.actor.kind === 'employee' ? ctx.actor.employeeId : null);

// ---------------------------------------------------------------------------
// Read ops for other modules
// ---------------------------------------------------------------------------

/** Notifications C6 re-check, access. */
export async function getEmployeeStatus(db: Queryable, employeeId: string): Promise<{ id: string; role: Role; isActive: boolean } | null> {
  const r = await repo.findById(db, employeeId);
  return r ? { id: r.id, role: r.role, isActive: r.is_active } : null;
}

/** BE5-R2: recipient contact for security/business emails (id, email, name, active only). */
/**
 * BL-05 (BE3-R3): batch display names for other modules, one query. Unknown ids are absent from
 * the map. Returns id/name/active only (no email, no role), like `getEmployeeContact` (BE5-R2).
 */
export async function employeeNames(
  db: Queryable,
  ids: readonly (string | null | undefined)[]
): Promise<Map<string, { name: string; isActive: boolean }>> {
  const out = new Map<string, { name: string; isActive: boolean }>();
  const list = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (list.length === 0) return out;
  const { rows } = await db.query<{ id: string; full_name: string; is_active: boolean }>(
    'SELECT id, full_name, is_active FROM employees WHERE id = ANY($1::uuid[])',
    [list]
  );
  for (const r of rows) out.set(r.id, { name: r.full_name, isActive: r.is_active });
  return out;
}

/** BL-11: active employees of one role (id + name), sorted by name. For pickers such as "Assign developer". */
export async function activeEmployeesByRole(db: Queryable, role: Role): Promise<{ id: string; name: string }[]> {
  const { rows } = await db.query<{ id: string; full_name: string }>(
    'SELECT id, full_name FROM employees WHERE role = $1 AND is_active = true ORDER BY full_name, id',
    [role]
  );
  return rows.map((r) => ({ id: r.id, name: r.full_name }));
}

export async function getEmployeeContact(
  db: Queryable,
  employeeId: string
): Promise<{ id: string; email: string; fullName: string; isActive: boolean } | null> {
  const r = await repo.findById(db, employeeId);
  return r ? { id: r.id, email: r.email, fullName: r.full_name, isActive: r.is_active } : null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List/detail rows: security summary + the OWN-002 "Open work" column and "Missing checkout" flag
 * (attendance open sessions; other modules' counts through `openItems`, `null` = not available yet).
 */
async function withSecurity(db: Queryable, rows: repo.EmployeeRecord[]): Promise<EmployeeRowDto[]> {
  const ids = rows.map((r) => r.id);
  const sec = await securitySummaries(db, ids);
  const att = await attendanceOpenWork(db, ids);
  // V-02: batched (constant query count per page) instead of one openItems() fan-out per row.
  const work = await openItemsMany(db, ids, att);
  return rows.map((r, i) => {
    const a = att.get(r.id)!;
    return {
      ...repo.toDto(r),
      ...sec.get(r.id)!,
      openWork: work[i],
      missingCheckout: a.missingCheckout,
      openAttendanceSince: a.openSince,
    };
  });
}

export async function listEmployees(db: Queryable, q: EmployeeListQuery) {
  const { rows, total } = await repo.list(db, q);
  return { items: await withSecurity(db, rows), total };
}

export async function getEmployee(db: Queryable, id: string): Promise<EmployeeRowDto | null> {
  const r = await repo.findById(db, id);
  return r ? (await withSecurity(db, [r]))[0] : null;
}

export async function getOwnProfile(db: Queryable, id: string): Promise<EmployeeDto | null> {
  const r = await repo.findById(db, id);
  return r ? repo.toDto(r) : null;
}

/** `openItems` for a page of employees in a constant number of queries (same shape per id). */
async function openItemsMany(
  db: Queryable,
  ids: string[],
  att: Map<string, { openSessions: number }>
): Promise<(OpenItemCounts & { unavailable: string[] })[]> {
  const followUps = await openFollowUpCounts(db, ids);
  const deals = await dealsOpenItemsForMany(db, ids);
  const projects = await projectsOpenItemsForMany(db, ids);
  return ids.map((id) => {
    const p = projects.get(id)!;
    return {
      assignments: null,
      followUps: followUps.get(id)!,
      corrections: null,
      deals: deals.get(id)!.deals,
      projects: p.projects,
      openTasks: p.openTasks,
      openAttendanceSessions: att.get(id)!.openSessions,
      // Modules without an `openItemsFor` op yet: assignment, corrections (same as openItems()).
      unavailable: ['assignments', 'corrections'],
    };
  });
}

/**
 * Open items composed at the edge from each module's `openItemsFor` (plan §4.1). A module whose op
 * is not implemented yet is reported as `null` + listed in `unavailable`.
 */
export async function openItems(
  db: Queryable,
  employeeId: string,
  attendance?: { openSessions: number }
): Promise<OpenItemCounts & { unavailable: string[] }> {
  const unavailable: string[] = [];
  const counts: OpenItemCounts = {
    assignments: null,
    followUps: null,
    corrections: null,
    deals: null,
    projects: null,
    openTasks: null,
    openAttendanceSessions: null,
  };
  try {
    const items = await callsOpenItemsFor(db, employeeId);
    counts.followUps = items.filter((i) => i.type === 'follow_up').length;
  } catch (e) {
    if (!(isHttpError(e) && e.code === 'NOT_IMPLEMENTED')) throw e;
  }
  try {
    counts.deals = (await dealsOpenItemsFor(db, employeeId)).deals;
  } catch (e) {
    if (!(isHttpError(e) && e.code === 'NOT_IMPLEMENTED')) throw e;
  }
  try {
    const p = await projectsOpenItemsFor(db, employeeId);
    counts.projects = p.projects;
    counts.openTasks = p.openTasks;
  } catch (e) {
    if (!(isHttpError(e) && e.code === 'NOT_IMPLEMENTED')) throw e;
  }
  counts.openAttendanceSessions = (attendance ?? (await attendanceOpenWork(db, [employeeId])).get(employeeId)!).openSessions;
  // Modules without an `openItemsFor` op yet: assignment, corrections.
  for (const [k, v] of Object.entries(counts)) if (v === null) unavailable.push(k);
  return { ...counts, unavailable };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export type CommandOutcome =
  | { kind: 'ok'; employee: EmployeeRowDto }
  | { kind: 'unchanged'; employee: EmployeeRowDto }
  | { kind: 'not_found' }
  | { kind: 'conflict'; currentVersion: number; current?: EmployeeDto }
  | { kind: 'email_taken' }
  | { kind: 'self' }
  | { kind: 'last_owner' };

/**
 * Fixed v1 scope (approved 2026-10-29): exactly four roles. Any other role id (custom roles included) is refused
 * on create and update; existing custom-role rows are kept but cannot be assigned.
 */
function assertV1Role(role: string): void {
  if (!(ROLES as readonly string[]).includes(role)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Role "${role}" is not available: v1 has the Owner, Data Entry, Call Center and Developer roles only.`, {
      role: ['Choose Owner, Data Entry, Call Center or Developer'],
    });
  }
}

/** POST /api/employees → E-01. */
export async function createEmployee(ctx: CommandContext, input: CreateEmployeeInput): Promise<CommandOutcome> {
  assertV1Role(input.role);
  if (await repo.emailTaken(ctx.tx, input.email)) return { kind: 'email_taken' };
  const created = await repo.insert(ctx.tx, {
    email: input.email,
    fullName: input.fullName,
    role: input.role,
    phone: input.phone ?? null,
    department: input.department ?? null,
    jobTitle: input.jobTitle ?? null,
  });
  const setup = await issueCredentialSetup(ctx.tx, created.id, ctx.now, actorId(ctx));
  await audit(ctx, {
    eventName: 'account.created',
    entityType: 'employee',
    entityId: created.id,
    after: { role: created.role, isActive: true, version: created.version },
    payload: { securityTokenId: setup.securityTokenId },
    sourceWorkflow: 'WF-EMP-001',
  });
  await outbox.emit(ctx.tx, {
    name: 'account.created',
    aggregateType: 'employee',
    aggregateId: created.id,
    payload: { securityTokenId: setup.securityTokenId },
  });
  return { kind: 'ok', employee: (await withSecurity(ctx.tx, [created]))[0] };
}

/** PATCH /api/employees/:id → profile edit; role change → E-02 (sessions revoked). */
export async function updateEmployee(
  ctx: CommandContext,
  id: string,
  input: UpdateEmployeeInput
): Promise<CommandOutcome & { roleChanged?: boolean }> {
  const target = await repo.findById(ctx.tx, id, true);
  if (!target) return { kind: 'not_found' };
  if (target.version !== input.version) return { kind: 'conflict', currentVersion: target.version, current: repo.toDto(target) }; // BL-09

  if (input.role) assertV1Role(input.role);

  const next = {
    email: input.email ?? target.email,
    fullName: input.fullName ?? target.full_name,
    role: input.role ?? target.role,
    phone: input.phone === undefined ? target.phone : input.phone,
    department: input.department === undefined ? target.department : input.department,
    jobTitle: input.jobTitle === undefined ? target.job_title : input.jobTitle,
  };
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const compare: [string, unknown, unknown][] = [
    ['email', target.email, next.email],
    ['fullName', target.full_name, next.fullName],
    ['role', target.role, next.role],
    ['phone', target.phone, next.phone],
    ['department', target.department, next.department],
    ['jobTitle', target.job_title, next.jobTitle],
  ];
  for (const [k, b, a] of compare) if (b !== a) [before[k], after[k]] = [b, a];
  if (Object.keys(after).length === 0) return { kind: 'unchanged', employee: (await withSecurity(ctx.tx, [target]))[0] };

  const roleChanged = next.role !== target.role;
  if (roleChanged) {
    // An Owner cannot change their own role (would drop their own access mid-session).
    if (id === actorId(ctx)) return { kind: 'self' };
    if (target.role === 'owner' && target.is_active) {
      const owners = await repo.lockActiveOwners(ctx.tx);
      if (owners.filter((o) => o !== id).length === 0) return { kind: 'last_owner' };
    }
  }
  if (next.email !== target.email && (await repo.emailTaken(ctx.tx, next.email, id))) return { kind: 'email_taken' };

  const updated = await repo.update(ctx.tx, id, input.version, next);
  if (!updated) return { kind: 'conflict', currentVersion: (await repo.findById(ctx.tx, id))?.version ?? input.version };

  // Personal fields are kept out of the audit payload except the changed field names; role/email are
  // the security-relevant values and are recorded with before/after.
  const securityKeys = ['role', 'email'];
  const pick = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, securityKeys.includes(k) ? v : '(changed)']));
  await audit(ctx, {
    eventName: 'employee.updated', // placeholder name; needs approval (G2)
    entityType: 'employee',
    entityId: id,
    before: { ...pick(before), version: target.version },
    after: { ...pick(after), version: updated.version },
    reason: input.reason ?? null,
    payload: { fields: Object.keys(after) },
    sourceWorkflow: 'WF-EMP-001',
  });
  if (roleChanged) {
    await audit(ctx, {
      eventName: 'account.role_changed',
      entityType: 'employee',
      entityId: id,
      before: { role: target.role },
      after: { role: updated.role },
      reason: input.reason ?? null,
      sourceWorkflow: 'WF-EMP-001',
    });
    await outbox.emit(ctx.tx, {
      name: 'account.role_changed',
      aggregateType: 'employee',
      aggregateId: id,
      payload: { fromRole: target.role, toRole: updated.role },
    });
  }
  return { kind: 'ok', employee: (await withSecurity(ctx.tx, [updated]))[0], roleChanged };
}

/** PATCH /api/employees/:id/status (SEQ-03) → E-02 on deactivation. */
export async function setEmployeeStatus(
  ctx: CommandContext,
  id: string,
  input: { isActive: boolean; version: number; reason?: string }
): Promise<CommandOutcome> {
  const target = await repo.findById(ctx.tx, id, true);
  if (!target) return { kind: 'not_found' };
  if (target.version !== input.version) return { kind: 'conflict', currentVersion: target.version, current: repo.toDto(target) }; // BL-09
  if (target.is_active === input.isActive) return { kind: 'unchanged', employee: (await withSecurity(ctx.tx, [target]))[0] };

  if (!input.isActive) {
    if (id === actorId(ctx)) return { kind: 'self' };
    if (target.role === 'owner') {
      const owners = await repo.lockActiveOwners(ctx.tx);
      if (owners.filter((o) => o !== id).length === 0) return { kind: 'last_owner' };
    }
  }

  const updated = await repo.setActive(ctx.tx, id, input.version, input.isActive);
  if (!updated) return { kind: 'conflict', currentVersion: (await repo.findById(ctx.tx, id))?.version ?? input.version };
  await audit(ctx, {
    // account.deactivated is the SEQ-03 name; account.activated is a placeholder (needs approval, G2).
    eventName: input.isActive ? 'account.activated' : 'account.deactivated',
    entityType: 'employee',
    entityId: id,
    before: { isActive: target.is_active, version: target.version },
    after: { isActive: input.isActive, version: updated.version },
    reason: input.reason ?? null,
    securityEvent: true,
    sourceWorkflow: 'WF-EMP-001',
  });
  if (!input.isActive) {
    await outbox.emit(ctx.tx, { name: 'account.deactivated', aggregateType: 'employee', aggregateId: id });
  } else {
    // D20 (approved): reactivation never restores old sessions, credentials or MFA. The old password and TOTP
    // enrolment are invalidated and the employee sets a new password through the existing credential-setup
    // invitation (E-01 template; the raw token goes only to MOD-notifications, never to the audit or logs).
    const reset = await invalidateCredentialsForReactivation(ctx.tx, id);
    const setup = await issueCredentialSetup(ctx.tx, id, ctx.now, actorId(ctx));
    await audit(ctx, {
      eventName: 'account.credentials_invalidated', // placeholder name; needs approval (G2)
      entityType: 'employee',
      entityId: id,
      payload: { ...reset, securityTokenId: setup.securityTokenId },
      securityEvent: true,
      sourceWorkflow: 'WF-EMP-001',
    });
    // The existing set-password invitation: MOD-notifications' security e-mail consumer sends the
    // credential-setup link for `account.created` (log/memory transport outside production).
    await outbox.emit(ctx.tx, {
      name: 'account.created',
      aggregateType: 'employee',
      aggregateId: id,
      payload: { securityTokenId: setup.securityTokenId, reactivated: true },
    });
  }
  // OQ-14 (Demonstration alternative — not approved): reactivation does not restore assignments.
  return { kind: 'ok', employee: (await withSecurity(ctx.tx, [updated]))[0] };
}
