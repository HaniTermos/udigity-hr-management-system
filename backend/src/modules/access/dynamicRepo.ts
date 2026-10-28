/**
 * MOD-access dynamic RBAC repository. Owner: BE2.
 * Interacts with `custom_roles` and `role_permissions`.
 */
import type { Queryable } from '../../db/pool.js';

export interface CustomRoleRecord {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  version: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  employee_count: number;
}

export interface RolePermissionRecord {
  id: string;
  role_id: string;
  action: string;
  data_scope: 'self' | 'department' | 'global' | 'assigned_only';
  created_at: Date;
}

export async function listRoles(db: Queryable): Promise<CustomRoleRecord[]> {
  const { rows } = await db.query<CustomRoleRecord>(`
    SELECT 
      r.id,
      r.name,
      r.description,
      r.is_system,
      r.version,
      r.created_by,
      r.created_at,
      r.updated_at,
      COUNT(e.id)::int AS employee_count
    FROM custom_roles r
    LEFT JOIN employees e ON e.role = r.id AND e.is_active = true
    GROUP BY r.id, r.name, r.description, r.is_system, r.version, r.created_by, r.created_at, r.updated_at
    ORDER BY r.is_system DESC, r.name ASC
  `);
  return rows;
}

export async function findRoleById(db: Queryable, id: string): Promise<CustomRoleRecord | null> {
  const { rows } = await db.query<CustomRoleRecord>(
    `
    SELECT 
      r.id,
      r.name,
      r.description,
      r.is_system,
      r.version,
      r.created_by,
      r.created_at,
      r.updated_at,
      COUNT(e.id)::int AS employee_count
    FROM custom_roles r
    LEFT JOIN employees e ON e.role = r.id AND e.is_active = true
    WHERE r.id = $1
    GROUP BY r.id, r.name, r.description, r.is_system, r.version, r.created_by, r.created_at, r.updated_at
  `,
    [id]
  );
  return rows[0] ?? null;
}

export async function roleExists(db: Queryable, id: string): Promise<boolean> {
  const { rows } = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM custom_roles WHERE id = $1) AS exists`,
    [id]
  );
  return rows[0]?.exists ?? false;
}

export async function findPermissionsForRole(db: Queryable, roleId: string): Promise<RolePermissionRecord[]> {
  const { rows } = await db.query<RolePermissionRecord>(
    `
    SELECT id, role_id, action, data_scope, created_at
    FROM role_permissions
    WHERE role_id = $1
    ORDER BY action ASC
  `,
    [roleId]
  );
  return rows;
}

export async function insertRole(
  db: Queryable,
  role: { id: string; name: string; description?: string | null; createdBy?: string | null; isSystem?: boolean }
): Promise<CustomRoleRecord> {
  const { rows } = await db.query<CustomRoleRecord>(
    `
    INSERT INTO custom_roles (id, name, description, created_by, is_system)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, description, is_system, version, created_by, created_at, updated_at, 0 AS employee_count
  `,
    [role.id, role.name, role.description ?? null, role.createdBy ?? null, role.isSystem ?? false]
  );
  return rows[0];
}

/** Bumps `version` (IC-16). With `expectedVersion`, the row is updated only when it still has that version (null = conflict). */
export async function updateRole(
  db: Queryable,
  id: string,
  patch: { name?: string; description?: string | null },
  expectedVersion: number | null = null
): Promise<CustomRoleRecord | null> {
  const { rows } = await db.query<CustomRoleRecord>(
    `
    UPDATE custom_roles
    SET 
      name = COALESCE($2::varchar, name),
      description = CASE WHEN $3::text IS NULL AND $4::boolean = true THEN NULL ELSE COALESCE($3::text, description) END,
      version = version + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND ($5::int IS NULL OR version = $5::int)
    RETURNING id, name, description, is_system, version, created_by, created_at, updated_at, 0 AS employee_count
  `,
    [id, patch.name ?? null, patch.description ?? null, patch.description === null, expectedVersion]
  );
  return rows[0] ?? null;
}

export async function deleteRole(db: Queryable, id: string): Promise<boolean> {
  const { rowCount } = await db.query(`DELETE FROM custom_roles WHERE id = $1 AND is_system = false`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function hasAssignedEmployees(db: Queryable, roleId: string): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM employees WHERE role = $1`,
    [roleId]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

export async function replaceRolePermissions(
  db: Queryable,
  roleId: string,
  permissions: { action: string; dataScope?: string }[]
): Promise<void> {
  await db.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
  if (permissions.length === 0) return;

  const values: unknown[] = [];
  const valueClauses: string[] = [];

  permissions.forEach((p, idx) => {
    const baseIdx = idx * 3;
    valueClauses.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3})`);
    values.push(roleId, p.action, p.dataScope ?? 'global');
  });

  await db.query(
    `
    INSERT INTO role_permissions (role_id, action, data_scope)
    VALUES ${valueClauses.join(', ')}
    ON CONFLICT (role_id, action) DO UPDATE SET data_scope = EXCLUDED.data_scope
  `,
    values
  );
}

export async function revokeSessionsForRole(db: Queryable, roleId: string): Promise<number> {
  const { rowCount } = await db.query(
    `
    UPDATE sessions s
    SET state = 'ended', end_reason = 'revoked', ended_at = CURRENT_TIMESTAMP
    FROM employees e
    WHERE s.employee_id = e.id AND e.role = $1 AND s.state <> 'ended'
  `,
    [roleId]
  );
  return rowCount ?? 0;
}

export async function loadAllRolePermissions(
  db: Queryable
): Promise<{ role_id: string; action: string; data_scope: 'self' | 'department' | 'global' | 'assigned_only' }[]> {
  const { rows } = await db.query<{
    role_id: string;
    action: string;
    data_scope: 'self' | 'department' | 'global' | 'assigned_only';
  }>(`SELECT role_id, action, data_scope FROM role_permissions`);
  return rows;
}
