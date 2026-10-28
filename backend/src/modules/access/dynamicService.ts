/**
 * MOD-access dynamic RBAC service (migration 014; authz-matrix.md §3.11). Owner: BE2.
 *
 * Custom roles hold exactly the validated grants in `role_permissions`. Safety rules:
 *   - every granted action is a matrix action; nobody-rows are never grantable; privileged (admin /
 *     Owner-only) rows only when the matrix marks them `grantable` (the holder then still needs a
 *     verified second factor, shared/access.ts);
 *   - the four system roles are a CONTRACT: their permissions can never be edited or widened here;
 *   - the in-process cache is loaded from the database at startup and reloaded only AFTER a role
 *     command has committed (routes.ts); a rolled-back command never leaves phantom grants. Other API
 *     or worker processes converge through the TTL refresh.
 */
import type { Queryable } from '../../db/pool.js';
import { HttpError, notFound, versionConflict } from '../../shared/errors.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import {
  DATA_SCOPES,
  isSystemRole,
  registerDynamicRoleChecker,
  type Action,
  type DataScope,
  type DynamicRoleChecker,
} from '../../shared/access.js';
import { AUTHZ_MATRIX, grantRefusal, isPrivilegedMatrixRow, type MatrixRow } from './matrix.js';
import * as repo from './dynamicRepo.js';
import type {
  CreateRoleInput,
  PermissionCatalogItem,
  RoleDetailDto,
  RolePermissionInput,
  RoleSummaryDto,
  UpdateRoleInput,
} from './dynamicSchemas.js';

const actorId = (ctx: CommandContext) => (ctx.actor.kind === 'employee' ? ctx.actor.employeeId : null);

/** Other processes see a committed grant change within this many ms (same process: immediately). */
export const ROLE_CACHE_TTL_MS = 30_000;

export class DynamicRoleCache implements DynamicRoleChecker {
  private cache = new Map<string, Map<string, DataScope>>();
  private db: Queryable | null = null;
  private loadedAt = 0;
  private loading: Promise<void> | null = null;

  /** Startup (module init): remember the pool and start the first load. */
  attach(db: Queryable): void {
    this.db = db;
    void this.reload().catch((err: unknown) => {
      console.error('[access] custom-role grants could not be loaded at startup; custom roles are denied until a load succeeds', {
        message: (err as Error)?.message,
      });
    });
  }

  /** Full replace from `role_permissions`. Rows for system roles are ignored (never widened). */
  async reload(db: Queryable | null = this.db): Promise<void> {
    if (!db) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const rows = await repo.loadAllRolePermissions(db);
      const next = new Map<string, Map<string, DataScope>>();
      for (const r of rows) {
        if (isSystemRole(r.role_id)) continue;
        if (!AUTHZ_MATRIX[r.action] || grantRefusal(r.action)) continue; // a row the matrix no longer allows
        if (!DATA_SCOPES.includes(r.data_scope)) continue;
        const entry = next.get(r.role_id) ?? new Map<string, DataScope>();
        entry.set(r.action, r.data_scope);
        next.set(r.role_id, entry);
      }
      this.cache = next;
      this.loadedAt = Date.now();
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /** Resolves once at least one load has completed (awaits an in-flight first load). */
  async ensureReady(): Promise<void> {
    if (this.loadedAt > 0) return;
    if (this.loading) return this.loading;
    if (this.db) return this.reload();
    throw new Error('DynamicRoleCache is not attached to a database');
  }

  grantFor(role: string, action: Action): DataScope | null {
    if (isSystemRole(role)) return null;
    this.refreshIfStale();
    return this.cache.get(role)?.get(action) ?? null;
  }

  private refreshIfStale(): void {
    if (!this.db || this.loading || Date.now() - this.loadedAt < ROLE_CACHE_TTL_MS) return;
    void this.reload().catch((err: unknown) => {
      console.error('[access] custom-role grant refresh failed; keeping the cached grants', { message: (err as Error)?.message });
    });
  }

  isLoaded(): boolean {
    return this.loadedAt > 0;
  }

  /** Test only: drop every grant and the attached pool. */
  resetForTests(): void {
    this.cache = new Map();
    this.loadedAt = 0;
    this.db = null;
  }
}

export const dynamicRoleCache = new DynamicRoleCache();
registerDynamicRoleChecker(dynamicRoleCache);

// ---------------------------------------------------------------------------
// Grant validation (one place answers "may a custom role hold this?")
// ---------------------------------------------------------------------------

/** Throws 400 VALIDATION_ERROR listing every grant the matrix refuses. */
export function validateGrants(permissions: readonly RolePermissionInput[]): void {
  const problems = permissions.map((p) => grantRefusal(p.action)).filter((m): m is string => Boolean(m));
  if (problems.length > 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'One or more grants are not allowed.', { grants: problems });
  }
}

// ---------------------------------------------------------------------------
// Permissions Catalog
// ---------------------------------------------------------------------------

function formatActionTitle(action: string): string {
  const parts = action.split('.');
  const verb = parts[1]?.replace(/_/g, ' ') ?? '';
  const noun = parts[0]?.replace(/_/g, ' ') ?? '';
  const qualifier = parts[2] ? ` (${parts[2].replace(/_/g, ' ')})` : '';
  return `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${noun}${qualifier}`.trim();
}

function resolveModuleForAction(action: string, row: MatrixRow): string {
  if (action.startsWith('auth.') || action.startsWith('session.')) return 'Identity & Security';
  if (action.startsWith('role.') || action.startsWith('permission.')) return 'Role & Permissions';
  if (action.startsWith('employee.') || action.startsWith('profile.')) return 'People & Organization';
  if (action.startsWith('attendance.')) return 'Attendance & Time Tracking';
  if (action.startsWith('business.') || action.startsWith('category.') || action.startsWith('correction.'))
    return 'Business Directory';
  if (
    action.startsWith('calling.') ||
    action.startsWith('call.') ||
    action.startsWith('reservation.') ||
    action.startsWith('follow_up.') ||
    action.startsWith('call_attempt.')
  )
    return 'Calling & Outreach';
  if (action.startsWith('deal.') || action.startsWith('meeting.') || action.startsWith('project.') || action.startsWith('task.'))
    return 'Deals & Projects';
  if (
    action.startsWith('target.') ||
    action.startsWith('work_item.') ||
    action.startsWith('settings.') ||
    action.startsWith('notification.') ||
    action.startsWith('reminder.')
  )
    return 'Targets & Work Items';
  if (action.startsWith('dashboard.') || action.startsWith('report.') || action.startsWith('audit.')) return 'Reports & Auditing';
  return row.section || 'General';
}

export function listPermissionsCatalog(): PermissionCatalogItem[] {
  const items: PermissionCatalogItem[] = [];
  for (const [action, row] of Object.entries(AUTHZ_MATRIX)) {
    const grantable = grantRefusal(action) === undefined;
    items.push({
      action,
      module: resolveModuleForAction(action, row),
      displayName: formatActionTitle(action),
      description: row.note ?? `Allows executing ${action}`,
      requiresAdmin: isPrivilegedMatrixRow(row),
      grantable,
      // Privileged rows act on the whole company by nature; the engine enforces the scope for the rest.
      allowedScopes: grantable ? (isPrivilegedMatrixRow(row) ? ['global'] : [...DATA_SCOPES]) : [],
    });
  }
  return items.sort((a, b) => a.module.localeCompare(b.module) || a.action.localeCompare(b.action));
}

// ---------------------------------------------------------------------------
// Role Operations
// ---------------------------------------------------------------------------

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : new Date().toISOString());

export async function listRoles(db: Queryable): Promise<RoleSummaryDto[]> {
  const records = await repo.listRoles(db);
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.is_system,
    version: r.version,
    employeeCount: r.employee_count,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }));
}

export async function getRole(db: Queryable, roleId: string): Promise<RoleDetailDto> {
  const r = await repo.findRoleById(db, roleId);
  if (!r) throw notFound();

  let permissionsList: RoleDetailDto['permissions'];
  if (isSystemRole(r.id)) {
    // System roles are defined by the matrix alone (never by role_permissions): show the contract.
    permissionsList = Object.entries(AUTHZ_MATRIX)
      .filter(([, row]) => r.id === 'owner' || (row.roles as readonly string[]).includes(r.id))
      .map(([action]) => ({ action, dataScope: 'global' as DataScope }));
  } else {
    const permissions = await repo.findPermissionsForRole(db, roleId);
    permissionsList = permissions.map((p) => ({ action: p.action, dataScope: p.data_scope }));
  }

  return {
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.is_system,
    version: r.version,
    employeeCount: r.employee_count,
    permissions: permissionsList.sort((a, b) => a.action.localeCompare(b.action)),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export async function createRole(ctx: CommandContext, input: CreateRoleInput): Promise<RoleDetailDto> {
  if (isSystemRole(input.id)) {
    throw new HttpError(400, 'BAD_REQUEST', `"${input.id}" is a system role identifier.`);
  }
  validateGrants(input.permissions);

  const exists = await repo.roleExists(ctx.tx, input.id);
  if (exists) {
    throw new HttpError(409, 'CONFLICT_DUPLICATE', `A role with identifier "${input.id}" already exists.`);
  }

  const role = await repo.insertRole(ctx.tx, {
    id: input.id,
    name: input.name,
    description: input.description ?? null,
    createdBy: actorId(ctx),
    isSystem: false,
  });

  if (input.permissions.length > 0) {
    await repo.replaceRolePermissions(ctx.tx, input.id, input.permissions);
  }

  await audit(ctx, {
    eventName: 'role.created',
    entityType: 'role',
    entityId: input.id,
    after: { name: role.name, permissions: input.permissions.map((p) => `${p.action}:${p.dataScope}`) },
    sourceWorkflow: 'WF-ROLE-001',
  });

  return getRole(ctx.tx, input.id);
}

export async function updateRole(ctx: CommandContext, roleId: string, input: UpdateRoleInput): Promise<RoleDetailDto> {
  const current = await repo.findRoleById(ctx.tx, roleId);
  if (!current) throw notFound();

  if (current.is_system || isSystemRole(current.id)) {
    throw new HttpError(400, 'BAD_REQUEST', 'System roles are defined by the authorization matrix and cannot be modified.');
  }
  if (input.permissions) validateGrants(input.permissions);
  // IC-16 optimistic concurrency: every committed change bumps `version`; a stale save is refused.
  if (input.version !== undefined && input.version !== current.version) throw versionConflict(current.version);
  const bumped = await repo.updateRole(ctx.tx, roleId, { name: input.name, description: input.description }, current.version);
  if (!bumped) throw versionConflict(current.version);

  if (input.permissions !== undefined) {
    const before = await repo.findPermissionsForRole(ctx.tx, roleId);
    await repo.replaceRolePermissions(ctx.tx, roleId, input.permissions);
    // Holders re-authenticate so the new grant set applies at once (and never from a stale session).
    const revokedCount = await repo.revokeSessionsForRole(ctx.tx, roleId);
    await audit(ctx, {
      eventName: 'role.permissions_updated',
      entityType: 'role',
      entityId: roleId,
      before: { permissions: before.map((p) => `${p.action}:${p.data_scope}`) },
      after: { permissions: input.permissions.map((p) => `${p.action}:${p.dataScope}`), sessionsRevoked: revokedCount },
      sourceWorkflow: 'WF-ROLE-002',
    });
  } else {
    await audit(ctx, {
      eventName: 'role.updated',
      entityType: 'role',
      entityId: roleId,
      before: { name: current.name },
      after: { name: input.name ?? current.name },
      sourceWorkflow: 'WF-ROLE-002',
    });
  }

  return getRole(ctx.tx, roleId);
}

export async function deleteRole(ctx: CommandContext, roleId: string): Promise<void> {
  const current = await repo.findRoleById(ctx.tx, roleId);
  if (!current) throw notFound();

  if (current.is_system || isSystemRole(current.id)) {
    throw new HttpError(400, 'BAD_REQUEST', 'System roles cannot be deleted.');
  }

  const assignedCount = await repo.hasAssignedEmployees(ctx.tx, roleId);
  if (assignedCount > 0) {
    throw new HttpError(
      409,
      'STATE_CONFLICT',
      `Cannot delete role "${current.name}". It is currently assigned to ${assignedCount} employee(s). Reassign them first.`
    );
  }

  await repo.deleteRole(ctx.tx, roleId);

  await audit(ctx, {
    eventName: 'role.deleted',
    entityType: 'role',
    entityId: roleId,
    before: { name: current.name, id: current.id },
    sourceWorkflow: 'WF-ROLE-003',
  });
}
