/**
 * MOD-access — the access engine v1 (plan.md §5; shared/access.ts contract). Owner: BE2.
 *
 * `check`, `checkMany` and `scopeFilter` are generated from ONE rule table (rules.ts) over the
 * access-facts view. Steps 1–4 are middleware (`authenticate`, `requireAction`); step 9 (resource
 * state) is the owning module's, after `check`.
 *
 * Resource resolution (plan §5): a business-related type resolves to its business through a
 * resolver the owning module registers (`registerResourceResolver`), which runs that module's own
 * read; the engine itself reads only the view. Until a type has a resolver, `check` on it answers
 * not_found (fail closed). Non-business types use role + own-record rules: the resolver returns
 * the owning employee ids.
 */
import type { Queryable } from '../../db/pool.js';
import type { Role } from '../../middleware/auth.js';
import {
  dynamicGrantFor,
  isSystemRole,
  type AccessDecision,
  type AccessEngine,
  type Action,
  type DataScope,
  type ExceptionRow,
  type Principal,
  type ResourceRef,
  type ResourceType,
  type ScopeOptions,
} from '../../shared/access.js';
import { flags as envFlags } from '../../shared/flags.js';
import { getSetting } from '../admin/service.js';
import { clock } from '../platform/clock.js';
import { SqlParams } from '../../shared/sql.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import { fetchDecisionRows, type DecisionRow } from './repo.js';
import { buildRuleFragments, combinedPredicate, EXCEPTION_ROWS, isBusinessResource, type RuleFlags } from './rules.js';

export type ResolvedResource =
  /** The resource belongs to a business: steps 5–8 run on that business. */
  | { kind: 'business'; businessId: string }
  /** Own-record resource: allowed (full) when the principal is one of the owners. */
  | { kind: 'own'; ownerIds: readonly string[] }
  /** Role-level resource: allowed (full) once `requireAction` passed (e.g. category). */
  | { kind: 'role' };

export type ResourceResolver = (db: Queryable, id: string) => Promise<ResolvedResource | null>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENT = /^[a-z_][a-z0-9_]*$/i;

/** OI-05 audit event name for Owner reads of a hidden business detail. */
export const OWNER_VIEWED_HIDDEN_EVENT = 'business_access.owner_viewed_hidden';

/** Call from the detail route when `decision.ownerViewedHidden` is set (plan §4.9). */
export function auditOwnerHiddenRead(ctx: CommandContext, businessId: string): Promise<void> {
  return audit(ctx, { eventName: OWNER_VIEWED_HIDDEN_EVENT, entityType: 'business', entityId: businessId });
}

const resolvers = new Map<ResourceType, ResourceResolver>();

/** Owning modules register how their resource type maps to a business / owner. One per type. */
export function registerResourceResolver(type: ResourceType, resolver: ResourceResolver): void {
  resolvers.set(type, resolver);
}

/** Resolvers for the types MOD-access answers itself. */
function installDefaultResolvers(): void {
  const business: ResourceResolver = async (_db, id) => ({ kind: 'business', businessId: id });
  resolvers.set('business', business);
  resolvers.set('duplicate_preview', business);
  resolvers.set('category', async () => ({ kind: 'role' }));
  resolvers.set('employee', async (_db, id) => ({ kind: 'own', ownerIds: [id] }));
}
installDefaultResolvers();

/**
 * Column holding the owning employee id for own-record list filters (non-business types).
 * Override per statement with `ScopeOptions.idColumn`. Owner-only types are not listed: a non-Owner
 * gets FALSE.
 */
const OWN_COLUMN: Partial<Record<ResourceType, string>> = {
  employee: 'id',
  attendance_session: 'employee_id',
  attendance_correction: 'employee_id',
  data_correction_request: 'requested_by',
  notification: 'recipient_id',
  calling_assignment: 'agent_id',
  target: 'employee_id',
  work_item: 'assignee_id',
};

/** Types every role may list once `requireAction` passed (module filters the rows, e.g. active only). */
const ROLE_LEVEL_TYPES: ReadonlySet<ResourceType> = new Set<ResourceType>(['category']);

/**
 * Custom roles (migration 014) on own-record types: the grant's `data_scope` decides the record set.
 * `global` = every record of the type; `department` = records of employees in the holder's department;
 * `self` / `assigned_only` = own records only. A system role never reaches this (matrix rules apply).
 */
function customScopeFor(principal: Principal, action: Action): DataScope | null {
  return isSystemRole(principal.role) ? null : dynamicGrantFor(principal.role, action);
}

/** `department` scope: is any of `ownerIds` in the holder's department (NULL departments never match)? */
async function sameDepartment(db: Queryable, holderId: string, ownerIds: readonly string[]): Promise<boolean> {
  if (ownerIds.length === 0) return false;
  const { rows } = await db.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM employees h JOIN employees o ON o.department = h.department
       WHERE h.id = $1::uuid AND h.department IS NOT NULL AND h.department <> '' AND o.id = ANY($2::uuid[])
     ) AS ok`,
    [holderId, ownerIds]
  );
  return rows[0]?.ok === true;
}

export interface EngineOptions {
  /** Clock (tests inject). */
  now?: () => Date;
  /** Flag source (tests inject both branches). Defaults to the env registry. */
  flags?: () => RuleFlags;
}

const DENY_PERMISSION: AccessDecision = { allowed: false, reason: 'permission_denied' };
const DENY_NOT_FOUND: AccessDecision = { allowed: false, reason: 'not_found' };

/** Step 2b for the engine: an Owner whose 2FA is pending is denied under R11-a, Owner under R11-b. */
function ownerPendingDenied(p: Principal, f: RuleFlags): boolean {
  return p.role === 'owner' && p.sessionState !== 'active' && f['auth.ownerPending2faScope'] === 'R11-a';
}

function decide(row: DecisionRow | undefined, role: Role, f: RuleFlags): AccessDecision {
  if (!row) return DENY_NOT_FOUND;
  if (role === 'owner') {
    const hiddenForOthers = !row.in_window;
    return {
      allowed: true,
      level: 'owner',
      ...(hiddenForOthers && f['access.auditOwnerHiddenReads'] ? { ownerViewedHidden: true } : {}),
    };
  }
  // D9/D20: an archived business (and everything related to it) does not exist for non-Owners (security R10).
  if (!row.live) return DENY_NOT_FOUND;
  if (!row.in_scope || !row.related) return DENY_PERMISSION;
  if (row.in_window) return { allowed: true, level: 'full' };
  const granting = EXCEPTION_ROWS.find((r) => row.rows[r]);
  if (granting) return { allowed: true, level: 'context_limited', exceptionRow: granting };
  return { allowed: false, reason: 'hidden_by_policy' };
}

// ---------------------------------------------------------------------------
// Stored settings the rule table reads (SET kind): `company.timezone` lives in company_settings (BE1).
// `check`/`checkMany` refresh it (async, TTL); `scopeFilter` is synchronous and uses the cached value.
// List endpoints call `refreshAccessSettings(db)` before building their scope predicate. While the value
// is unknown or empty, the rule table fails closed (rules.ts effectiveTimezone, security review R4).
// ---------------------------------------------------------------------------
const SETTINGS_TTL_MS = 30_000;
let cachedTimezone: { value: string; auditOwnerHiddenReads: boolean; at: number } | null = null;

/** Re-read the stored company timezone (cached for 30 s). Never throws: on error the cache is kept. */
export async function refreshAccessSettings(db: Queryable, force = false): Promise<void> {
  if (!force && cachedTimezone && Date.now() - cachedTimezone.at < SETTINGS_TTL_MS) return;
  try {
    const tz = await getSetting(db, 'company.timezone');
    const auditHidden = await getSetting(db, 'access.auditOwnerHiddenReads');
    cachedTimezone = { value: typeof tz === 'string' ? tz : '', auditOwnerHiddenReads: auditHidden !== false, at: Date.now() };
  } catch (err) {
    console.error('[access] could not read company.timezone; keeping the cached value', { message: (err as Error).message });
  }
}

let testOverrides: Partial<RuleFlags> = {};
/** Test only (NODE_ENV=test): switch rule flags for API-level tests of both FLAG branches. */
export function setRuleFlagOverridesForTests(over: Partial<RuleFlags>): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Rule flag overrides are available only when NODE_ENV=test');
  testOverrides = { ...over };
}

/** Production flag source: env registry + the stored company settings (+ test overrides). */
function productionFlags(): RuleFlags {
  if (!cachedTimezone) return { ...envFlags, ...testOverrides };
  return {
    ...envFlags,
    'company.timezone': cachedTimezone.value || envFlags['company.timezone'],
    'access.auditOwnerHiddenReads': cachedTimezone.auditOwnerHiddenReads,
    ...testOverrides,
  };
}

export function createAccessEngine(options: EngineOptions = {}): AccessEngine {
  // Platform clock: tests pin it (QA-2); production = system time.
  const now = options.now ?? (() => clock.now());
  const getFlags = options.flags ?? productionFlags;
  const refresh = options.flags ? async () => {} : (db: Queryable) => refreshAccessSettings(db);

  async function decideBusinesses(
    db: Queryable,
    principal: Principal,
    action: Action,
    type: ResourceType,
    businessIds: string[]
  ): Promise<Map<string, AccessDecision>> {
    const f = getFlags();
    const out = new Map<string, AccessDecision>();
    const valid = businessIds.filter((id) => UUID.test(id));
    for (const id of businessIds) if (!UUID.test(id)) out.set(id, DENY_NOT_FOUND);
    if (valid.length === 0) return out;
    const params = new SqlParams();
    const fr = buildRuleFragments({
      role: principal.role,
      employeeId: principal.employeeId,
      action,
      resourceType: type,
      now: now(),
      flags: f,
      params,
      dataScope: customScopeFor(principal, action),
    });
    const rows = await fetchDecisionRows(db, valid, fr, params);
    for (const id of valid) out.set(id, decide(rows.get(id), principal.role, f));
    return out;
  }

  /** `undefined` = no resolver for the type (permission denied, fail closed); `null` = does not exist. */
  async function resolve(db: Queryable, ref: ResourceRef): Promise<ResolvedResource | null | undefined> {
    const resolver = resolvers.get(ref.type);
    if (!resolver) return undefined;
    if (!UUID.test(ref.id)) return null;
    return resolver(db, ref.id);
  }

  async function check(db: Queryable, principal: Principal, action: Action, ref: ResourceRef): Promise<AccessDecision> {
    await refresh(db);
    const f = getFlags();
    if (ownerPendingDenied(principal, f)) return DENY_PERMISSION;
    const resolved = await resolve(db, ref);
    if (resolved === undefined) return DENY_PERMISSION;
    if (resolved === null) return DENY_NOT_FOUND;
    if (resolved.kind === 'business') {
      const m = await decideBusinesses(db, principal, action, ref.type, [resolved.businessId]);
      return m.get(resolved.businessId) ?? DENY_NOT_FOUND;
    }
    if (principal.role === 'owner') return { allowed: true, level: 'owner' };
    if (resolved.kind === 'role') return { allowed: true, level: 'full' };
    if (resolved.ownerIds.includes(principal.employeeId)) return { allowed: true, level: 'full' };
    const scope = customScopeFor(principal, action);
    if (scope === 'global') return { allowed: true, level: 'full' };
    if (scope === 'department' && (await sameDepartment(db, principal.employeeId, resolved.ownerIds))) {
      return { allowed: true, level: 'full' };
    }
    return DENY_PERMISSION;
  }

  async function checkMany(
    db: Queryable,
    principal: Principal,
    action: Action,
    refs: ResourceRef[]
  ): Promise<Map<string, AccessDecision>> {
    const out = new Map<string, AccessDecision>();
    if (refs.length === 0) return out;
    await refresh(db);
    const f = getFlags();
    if (ownerPendingDenied(principal, f)) {
      for (const r of refs) out.set(r.id, DENY_PERMISSION);
      return out;
    }
    // Resolve each ref, then evaluate the business ids of each resource type in one query per type
    // (security review R9: the rule fragments depend on the type, so mixed-type calls are grouped).
    const byType = new Map<ResourceType, Map<string, string[]>>();
    const customScope = customScopeFor(principal, action);
    for (const ref of refs) {
      const resolved = await resolve(db, ref);
      if (resolved === undefined) {
        out.set(ref.id, DENY_PERMISSION);
      } else if (resolved === null) {
        out.set(ref.id, DENY_NOT_FOUND);
      } else if (resolved.kind === 'business') {
        const byBusiness = byType.get(ref.type) ?? new Map<string, string[]>();
        const list = byBusiness.get(resolved.businessId) ?? [];
        list.push(ref.id);
        byBusiness.set(resolved.businessId, list);
        byType.set(ref.type, byBusiness);
      } else if (principal.role === 'owner') {
        out.set(ref.id, { allowed: true, level: 'owner' });
      } else if (resolved.kind === 'role' || resolved.ownerIds.includes(principal.employeeId)) {
        out.set(ref.id, { allowed: true, level: 'full' });
      } else if (customScope === 'global') {
        out.set(ref.id, { allowed: true, level: 'full' });
      } else if (customScope === 'department' && (await sameDepartment(db, principal.employeeId, resolved.ownerIds))) {
        out.set(ref.id, { allowed: true, level: 'full' });
      } else {
        out.set(ref.id, DENY_PERMISSION);
      }
    }
    for (const [type, byBusiness] of byType) {
      const decisions = await decideBusinesses(db, principal, action, type, [...byBusiness.keys()]);
      for (const [businessId, refIds] of byBusiness) {
        const d = decisions.get(businessId) ?? DENY_NOT_FOUND;
        for (const id of refIds) out.set(id, d);
      }
    }
    return out;
  }

  function scopeFilter(principal: Principal, action: Action, type: ResourceType, o: ScopeOptions): string {
    const f = getFlags();
    if (!IDENT.test(o.alias) || (o.idColumn !== undefined && !IDENT.test(o.idColumn))) {
      throw new Error('scopeFilter: alias/idColumn must be plain identifiers');
    }
    if (ownerPendingDenied(principal, f)) return 'FALSE';
    if (principal.role === 'owner') return 'TRUE';
    if (isBusinessResource(type)) {
      // For `business` the column is the PK; for related types it is the column holding the business id.
      const col = o.idColumn ?? (type === 'business' ? 'id' : 'business_id');
      const fr = buildRuleFragments({
        role: principal.role,
        employeeId: principal.employeeId,
        action,
        resourceType: type,
        now: now(),
        flags: f,
        params: o.params,
        dataScope: customScopeFor(principal, action),
      });
      return `EXISTS (SELECT 1 FROM access_facts af WHERE af.business_id = ${o.alias}.${col} AND ${combinedPredicate(fr)})`;
    }
    if (ROLE_LEVEL_TYPES.has(type)) return 'TRUE';
    const ownCol = o.idColumn ?? OWN_COLUMN[type];
    if (!ownCol) return 'FALSE';
    const scope = customScopeFor(principal, action);
    if (scope === 'global') return 'TRUE';
    const self = `${o.alias}.${ownCol} = ${o.params.add(principal.employeeId)}`;
    if (scope === 'department') {
      const holder = o.params.add(principal.employeeId);
      return `(${self} OR EXISTS (SELECT 1 FROM employees h JOIN employees o ON o.department = h.department WHERE h.id = ${holder} AND h.department IS NOT NULL AND h.department <> '' AND o.id = ${o.alias}.${ownCol}))`;
    }
    return self;
  }

  return { check, checkMany, scopeFilter };
}

/**
 * Owner list flag "Hidden from other roles" (SCR-DE-001 Owner view): TRUE when the 15-day window is closed
 * for everyone else. Uses the same window fragment as the engine (one rule table). Exception rows are not
 * considered: the flag says the record is past the window, not who still has context access.
 */
export function hiddenForOthersPredicate(alias: string, params: SqlParams, idColumn = 'id'): string {
  if (!IDENT.test(alias) || !IDENT.test(idColumn)) throw new Error('hiddenForOthersPredicate: plain identifiers only');
  const fr = buildRuleFragments({
    role: 'owner',
    employeeId: '00000000-0000-0000-0000-000000000000',
    action: 'business.list',
    resourceType: 'business',
    now: clock.now(),
    flags: productionFlags(),
    params,
  });
  return `NOT EXISTS (SELECT 1 FROM access_facts af WHERE af.business_id = ${alias}.${idColumn} AND ${fr.window})`;
}

/** The production engine (platform clock, env flags + stored settings). Registered by module.ts init(). */
export const accessEngine: AccessEngine = createAccessEngine();

/**
 * DEC-003 (i) shaping for duplicate previews (plan §6.2): a match the user may not read reveals
 * existence only. Returns what the duplicate-check response may contain about the match.
 */
export function duplicateRevelation(decision: AccessDecision): 'full' | 'existence_only' {
  return decision.allowed ? 'full' : 'existence_only';
}

export type { ExceptionRow };
