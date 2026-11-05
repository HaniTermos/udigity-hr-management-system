/**
 * MOD-employees — repository (raw parameterised SQL on this module's own tables only). Owner: BE1.
 * Owned tables: employees.
 */
import type { Queryable } from '../../db/pool.js';
import type { Role } from '../../middleware/auth.js';
import { SqlParams } from '../../shared/sql.js';
import { orderByClause, pageClause } from '../../shared/pagination.js';
import type { EmployeeDto, EmployeeListQuery } from './schemas.js';

export interface EmployeeRecord {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  is_active: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = 'id, email, full_name, role, phone, department, job_title, is_active, version, created_at, updated_at';

export function toDto(r: EmployeeRecord): EmployeeDto {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    role: r.role,
    phone: r.phone,
    department: r.department,
    jobTitle: r.job_title,
    isActive: r.is_active,
    version: r.version,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function findById(db: Queryable, id: string, forUpdate = false): Promise<EmployeeRecord | null> {
  const { rows } = await db.query<EmployeeRecord>(
    `SELECT ${COLUMNS} FROM employees WHERE id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [id]
  );
  return rows[0] ?? null;
}

const SORT = { fullName: 'full_name', email: 'email', role: 'role', createdAt: 'created_at' };

export async function list(db: Queryable, q: EmployeeListQuery): Promise<{ rows: EmployeeRecord[]; total: number }> {
  const p = new SqlParams();
  const where: string[] = ['TRUE'];
  if (q.q) {
    const like = p.add(`%${q.q.toLowerCase().replace(/[%_\\]/g, '\\$&')}%`);
    where.push(`(LOWER(full_name) LIKE ${like} OR LOWER(email) LIKE ${like})`);
  }
  if (q.role) where.push(`role = ${p.add(q.role)}`);
  if (q.status === 'active') where.push('is_active = true');
  if (q.status === 'deactivated') where.push('is_active = false');
  const w = where.join(' AND ');
  const { rows: c } = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM employees WHERE ${w}`, p.values);
  // Default order: name ascending (Inc 1 behaviour).
  const order = q.sort ? orderByClause(q, SORT, 'fullName') : 'ORDER BY full_name ASC';
  const { rows } = await db.query<EmployeeRecord>(
    `SELECT ${COLUMNS} FROM employees WHERE ${w} ${order}, id ${pageClause(q, p)}`,
    p.values
  );
  return { rows, total: Number(c[0]?.n ?? 0) };
}

export async function insert(
  db: Queryable,
  v: { email: string; fullName: string; role: Role; phone: string | null; department: string | null; jobTitle: string | null }
): Promise<EmployeeRecord> {
  const { rows } = await db.query<EmployeeRecord>(
    `INSERT INTO employees (email, full_name, role, phone, department, job_title, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING ${COLUMNS}`,
    [v.email, v.fullName, v.role, v.phone, v.department, v.jobTitle]
  );
  return rows[0];
}

export async function emailTaken(db: Queryable, email: string, exceptId?: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'SELECT 1 FROM employees WHERE LOWER(email) = LOWER($1) AND ($2::uuid IS NULL OR id <> $2::uuid)',
    [email, exceptId ?? null]
  );
  return (rowCount ?? 0) > 0;
}

/** Conditional update (§4.5). Returns null when the version no longer matches. */
export async function update(
  db: Queryable,
  id: string,
  version: number,
  v: { email: string; fullName: string; role: Role; phone: string | null; department: string | null; jobTitle: string | null }
): Promise<EmployeeRecord | null> {
  const { rows } = await db.query<EmployeeRecord>(
    `UPDATE employees SET email = $3, full_name = $4, role = $5, phone = $6, department = $7, job_title = $8,
       version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND version = $2 RETURNING ${COLUMNS}`,
    [id, version, v.email, v.fullName, v.role, v.phone, v.department, v.jobTitle]
  );
  return rows[0] ?? null;
}

export async function setActive(db: Queryable, id: string, version: number, isActive: boolean): Promise<EmployeeRecord | null> {
  const { rows } = await db.query<EmployeeRecord>(
    `UPDATE employees SET is_active = $3, version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND version = $2 RETURNING ${COLUMNS}`,
    [id, version, isActive]
  );
  return rows[0] ?? null;
}

/** Locks every active Owner row (last-active-Owner guard). */
export async function lockActiveOwners(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM employees WHERE role = 'owner' AND is_active = true FOR UPDATE`);
  return rows.map((r) => r.id);
}
