/**
 * Small helpers shared by the three BE4 modules (deals, meetings, projects). Owner: BE4.
 * Meetings and projects depend on deals (arch-a §3.2.1), so they import these through
 * `deals/service.ts`, never the other way round.
 */
import type { Queryable } from '../../db/pool.js';
import type { Role } from '../../middleware/auth.js';
import {
  access,
  assertAllowed,
  type AccessAllowed,
  type Action,
  type Principal,
  type ResourceRef,
} from '../../shared/access.js';
import { HttpError, permissionDenied } from '../../shared/errors.js';
import type { CommandContext } from '../../shared/tx.js';
import { getEmployeeContact, getEmployeeStatus } from '../employees/service.js';

export function principalOf(ctx: CommandContext): Principal {
  if (ctx.actor.kind !== 'employee') throw new Error('principalOf: system actor');
  return { employeeId: ctx.actor.employeeId, role: ctx.actor.role, sessionState: ctx.actor.sessionState };
}

export function actorIdOf(ctx: CommandContext): string | null {
  return ctx.actor.kind === 'employee' ? ctx.actor.employeeId : null;
}

export function roleOf(ctx: CommandContext): Role | 'system' {
  return ctx.actor.kind === 'employee' ? ctx.actor.role : 'system';
}

/** Access check inside the command transaction (plan §4.9). Denials carry no field values. */
export async function authorize(ctx: CommandContext, action: string, ref: ResourceRef): Promise<AccessAllowed> {
  const decision = await access.check(ctx.tx, principalOf(ctx), action as Action, ref);
  assertAllowed(decision);
  return decision;
}

export function requireOwner(ctx: CommandContext): void {
  if (roleOf(ctx) !== 'owner') throw permissionDenied();
}

/** An active employee with the given role, else 400 (field-level, no data about the employee). */
export async function assertActiveEmployee(db: Queryable, id: string, field: string, role?: Role): Promise<void> {
  const s = await getEmployeeStatus(db, id);
  if (!s || !s.isActive || (role && s.role !== role)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', {
      [field]: [role ? `Must be an active ${role.replace('_', ' ')}` : 'Must be an active employee'],
    });
  }
}

/** Display names for employee ids (through BE1's public read op). */
export async function employeeNames(db: Queryable, ids: Iterable<string | null | undefined>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const id of new Set([...ids].filter((x): x is string => Boolean(x)))) {
    const c = await getEmployeeContact(db, id);
    if (c) out.set(id, c.fullName);
  }
  return out;
}

/**
 * Business display names. TEMPORARY boundary exception (reported on the board, [BE4-R3]): BE2 has
 * no public read op for names yet, so this single read of `businesses(id, name)` is isolated here and
 * will be replaced by BE2's service op. Callers have already passed `access.check`/`scopeFilter` for
 * the business, so no hidden name is returned.
 */
export async function businessNames(db: Queryable, ids: Iterable<string>): Promise<Map<string, string>> {
  const list = [...new Set(ids)];
  if (list.length === 0) return new Map();
  const { rows } = await db.query<{ id: string; name: string }>(
    'SELECT id, name FROM businesses WHERE id = ANY($1::uuid[])',
    [list]
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}

export const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

/** DATE columns come back from pg as Date at local midnight; format them as YYYY-MM-DD without a TZ shift. */
export function isoDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Run independent reads one after another. A pg client (ctx.tx) must not run concurrent queries
 * (pg deprecates it), so DTO builders use this instead of Promise.all.
 */
export async function inSequence<const T extends readonly unknown[]>(thunks: { [K in keyof T]: () => Promise<T[K]> }): Promise<T> {
  const out: unknown[] = [];
  for (const t of thunks as readonly (() => Promise<unknown>)[]) out.push(await t());
  return out as unknown as T;
}
