/**
 * MOD-calls — read adapters for data owned by other modules. Owner: BE3.
 *
 * TEMPORARY READS (precedent BE5-R2): `businesses` (BE2) and `employees` (BE1) columns needed for
 * display and guards. Each function names the service op that will replace it; the REQUESTs are on
 * the board (BE3-R2 to BE2, BE3-R3 to BE1). Columns read: businesses.id/name/archived_at,
 * employees.id/full_name/role/is_active. Nothing here writes.
 *
 * SQL fragments (`BUSINESS_NAME_JOIN`) are used by list queries that must sort by name; they read
 * the same two columns.
 */
import type { Queryable } from '../../db/pool.js';
import type { Role } from '../../middleware/auth.js';
import { employeeNames, getEmployeeStatus } from '../employees/service.js';

export interface BusinessInfo {
  id: string;
  name: string;
  archived: boolean;
}

/** Replaced by BE2 `businesses.service.businessSummaries(db, ids)` (BE3-R2). */
export async function businessInfo(db: Queryable, ids: readonly string[]): Promise<Map<string, BusinessInfo>> {
  const out = new Map<string, BusinessInfo>();
  if (ids.length === 0) return out;
  const { rows } = await db.query<{ id: string; name: string; archived_at: Date | null }>(
    'SELECT id, name, archived_at FROM businesses WHERE id = ANY($1::uuid[])',
    [[...new Set(ids)]]
  );
  for (const r of rows) out.set(r.id, { id: r.id, name: r.name, archived: r.archived_at !== null });
  return out;
}

/** BL-05: delegates to the BE1 batch op `employees.service.employeeNames` (BE3-R3 done). */
export async function employees(db: Queryable, ids: readonly (string | null)[]): Promise<Map<string, { name: string; isActive: boolean }>> {
  return employeeNames(db, ids);
}

/** BE1 service op (exists). */
export async function employeeStatus(db: Queryable, id: string): Promise<{ id: string; role: Role; isActive: boolean } | null> {
  return getEmployeeStatus(db, id);
}

/** Active Call Center agent or Owner (follow-up responsible, B3-Q04 / design §7). */
export async function isActiveCallingUser(db: Queryable, id: string, roles: readonly Role[] = ['call_center', 'owner']): Promise<boolean> {
  const s = await employeeStatus(db, id);
  return Boolean(s && s.isActive && roles.includes(s.role));
}
