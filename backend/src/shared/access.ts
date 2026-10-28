/**
 * Access / visibility engine CONTRACT (ADR-017, arch-b §6–§7, WF-ACCESS-001, SM-VISIBILITY-001).
 * Owner of this file: Tech Lead (contract). Owner of the implementation: BE2 (`modules/access`).
 * docs/implementation/plan.md §5 is the prose version of this contract.
 *
 * There is exactly ONE access definition (contract C5). Every module uses it like this:
 *   1. Route level (VT-3, steps 1–4): `requireAction('<resource>.<verb>')` middleware.
 *      Role + action only, no DB. Owner-only/admin actions also require completed 2FA.
 *   2. Single resource (steps 5–9): `await access.check(tx, principal, action, { type, id })`,
 *      then `assertAllowed(decision)`; Owner reads of hidden records are audited (OI-05).
 *   3. Lists / search / calendars / exports: `access.scopeFilter(principal, action, type, { alias, params })`
 *      returns a SQL predicate applied BEFORE count, sort and paging. Totals never include hidden rows.
 *   4. Related items on a page: `access.checkMany(...)` (one round trip) for per-row decisions.
 * Both forms read the same access-facts view, so `check` and `scopeFilter` cannot drift
 * (contract tests run the VT-7 worked evaluations against both).
 *
 * Fail closed: until BE2 registers the real engine, every resource check denies.
 */
import type { Request, Response, NextFunction } from 'express';
import type { Queryable } from '../db/pool.js';
import type { Role } from '../middleware/auth.js';
import type { SessionState } from '../modules/identity/security.js';
import { HttpError, hiddenByPolicy, notFound, permissionDenied } from './errors.js';
import type { SqlParams } from './sql.js';

/** R-06: the 11 resource types the access check must cover, plus non-business resources. */
export type ResourceType =
  // R-06 (business-related; the visibility engine applies)
  | 'business'
  | 'call_attempt'
  | 'follow_up'
  | 'reservation'
  | 'deal'
  | 'meeting'
  | 'project'
  | 'task'
  | 'notification'
  | 'export_row'
  | 'duplicate_preview'
  // Non-business resources (role + own-record rules only)
  | 'employee'
  | 'attendance_session'
  | 'attendance_correction'
  | 'attendance_break'
  | 'data_correction_request'
  | 'category'
  | 'calling_assignment'
  | 'target'
  | 'work_item'
  | 'audit_event'
  | 'setting'
  | 'report'
  | 'role';

/**
 * Action names are the `docs/security/authz-matrix.md` names: `<area>.<verb>[.<qualifier>]`, e.g.
 * `business.read`, `deal.record_payment`, `auth.password_reset.assist`. The prefix is not limited to
 * a ResourceType (matrix areas such as `auth`, `calling`, `settings`, `dashboard`; BE2-R1).
 */
export type Action = `${string}.${string}`;

export interface Principal {
  employeeId: string;
  role: Role;
  sessionState: SessionState;
}

export interface ResourceRef {
  type: ResourceType;
  id: string;
}

/** DEC-002 active-work exception rows (policy-defaults: Alt B on all six; flag `visibility.dec002Rows`). */
export type ExceptionRow =
  | 'R1_ACCEPTED_OPPORTUNITY'
  | 'R2_CLOSED_DEAL'
  | 'R3_ACTIVE_PROJECT'
  | 'R4_COMPLETED_PROJECT'
  | 'R5_SCHEDULED_CALLBACK'
  | 'R6_OPEN_CORRECTION';

/** Step 10 outcome. `context_limited` = allowed only on the surface of `exceptionRow` (OI-27). */
export type AccessLevel = 'full' | 'context_limited' | 'owner';

/** What the UI shows on denial (OI-10): "Not found" / "Permission denied" / "Record hidden by policy". */
export type DenialReason = 'not_found' | 'permission_denied' | 'hidden_by_policy';

export type AccessAllowed = {
  allowed: true;
  level: AccessLevel;
  /** Set when level = context_limited. */
  exceptionRow?: ExceptionRow;
  /** True when the Owner opened a record that is hidden for everyone else (audit per OI-05). */
  ownerViewedHidden?: boolean;
};

export type AccessDecision = AccessAllowed | { allowed: false; reason: DenialReason };

export interface ScopeOptions {
  /** SQL alias of the table being filtered, e.g. `b` for `businesses b`. */
  alias: string;
  /** Shared parameter list of the statement being built. */
  params: SqlParams;
  /** Primary-key column of the aliased table (default `id`). */
  idColumn?: string;
}

export interface AccessEngine {
  check(db: Queryable, principal: Principal, action: Action, resource: ResourceRef): Promise<AccessDecision>;
  checkMany(
    db: Queryable,
    principal: Principal,
    action: Action,
    resources: ResourceRef[]
  ): Promise<Map<string, AccessDecision>>;
  /** SQL boolean predicate (no leading AND). Owner path returns `TRUE`; unknown cases return `FALSE`. */
  scopeFilter(principal: Principal, action: Action, resourceType: ResourceType, options: ScopeOptions): string;
}

// ---------------------------------------------------------------------------
// VT-3 route-level action policy (steps 3–4). Each module declares its actions in its
// `schemas.ts` with `defineActions(...)`; the registry rejects duplicates at startup.
// ---------------------------------------------------------------------------

export interface ActionPolicy {
  roles: readonly Role[];
  /** Admin action (Owner only): always requires completed 2FA, under both R-11 readings. */
  admin?: boolean;
  /**
   * Privileged (admin / Owner-only) row that the matrix explicitly allows a CUSTOM role to hold
   * (`docs/security/authz-matrix.md` §3.11). A custom-role holder still passes the second-factor gate.
   * Privileged rows without this marker can never be granted to or executed by a custom role.
   */
  grantable?: boolean;
  description?: string;
}

const actionRegistry = new Map<Action, ActionPolicy>();

// ---------------------------------------------------------------------------
// Custom (dynamic) roles — migration 014. The four matrix roles are a CONTRACT and are never widened
// at runtime; any other role id is a custom role that holds exactly the validated grants in
// `role_permissions`, each with a `data_scope` the engine enforces (modules/access/dynamicService.ts).
// ---------------------------------------------------------------------------

/** The four matrix roles. Every other role id is a custom role. */
export const SYSTEM_ROLES: readonly Role[] = ['owner', 'data_entry', 'call_center', 'developer'];

export function isSystemRole(role: Role): boolean {
  return SYSTEM_ROLES.includes(role);
}

/** `data_scope` of a custom-role grant (migration 014). Semantics per resource kind: rules.ts / service.ts. */
export type DataScope = 'self' | 'department' | 'global' | 'assigned_only';

export const DATA_SCOPES: readonly DataScope[] = ['self', 'department', 'global', 'assigned_only'];

/**
 * Answers the validated grant a custom role holds for an action: its `data_scope`, or `null` when the
 * role holds none. Consulted ONLY for custom roles. `ensureReady` resolves once the grants are loaded
 * from the database (startup load; the route middleware awaits it so a cold process fails closed
 * only while the load is in flight, never after).
 */
export interface DynamicRoleChecker {
  grantFor(role: Role, action: Action): DataScope | null;
  ensureReady(): Promise<void>;
}

let dynamicRoleChecker: DynamicRoleChecker | null = null;

export function registerDynamicRoleChecker(checker: DynamicRoleChecker): void {
  dynamicRoleChecker = checker;
}

/** The custom-role grant for `role`/`action` (null for system roles, unknown roles, no checker). */
export function dynamicGrantFor(role: Role, action: Action): DataScope | null {
  if (isSystemRole(role) || !dynamicRoleChecker) return null;
  return dynamicRoleChecker.grantFor(role, action);
}

/**
 * Holder-side second-factor gate for a `grantable` privileged action executed by a custom role.
 * Identity registers the real check (a session that completed TOTP); until then it answers false, so
 * grantable privileged rows are grant-able but not executable (fail closed; matrix §1 "2FA").
 */
export type SecondFactorVerifier = (user: NonNullable<Request['user']>) => boolean;

let secondFactorVerifier: SecondFactorVerifier = () => false;

export function registerSecondFactorVerifier(verifier: SecondFactorVerifier): void {
  secondFactorVerifier = verifier;
}

/** Admin, Owner-only or nobody rows: never reachable by a custom role unless the row is `grantable`. */
export function isPrivilegedPolicy(policy: ActionPolicy): boolean {
  return Boolean(policy.admin) || policy.roles.length === 0 || (policy.roles.length === 1 && policy.roles[0] === 'owner');
}

/** The privileged rows the matrix marks `grantable` (registered by modules/access/matrix.ts at load). */
const grantableActions = new Set<Action>();

export function registerGrantableActions(actions: Iterable<Action>): void {
  for (const a of actions) grantableActions.add(a);
}

export function isGrantableAction(policy: ActionPolicy, action: Action): boolean {
  return Boolean(policy.grantable) || grantableActions.has(action);
}

type CustomRoleVerdict = 'allowed' | 'forbidden' | 'second_factor_required';

/** Steps 3–4 for a custom role: validated grant, privileged rows only when grantable + second factor. */
function customRoleVerdict(policy: ActionPolicy, role: Role, action: Action, user: NonNullable<Request['user']> | null): CustomRoleVerdict {
  if (!dynamicGrantFor(role, action)) return 'forbidden';
  if (!isPrivilegedPolicy(policy)) return 'allowed';
  if (!isGrantableAction(policy, action)) return 'forbidden';
  if (!user || user.sessionState !== 'active' || !secondFactorVerifier(user)) return 'second_factor_required';
  return 'allowed';
}

export function defineActions<T extends Partial<Record<Action, ActionPolicy>>>(policies: T): T {
  for (const [action, policy] of Object.entries(policies) as [Action, ActionPolicy][]) {
    if (actionRegistry.has(action)) throw new Error(`Access action defined twice: ${action}`);
    actionRegistry.set(action, policy);
  }
  return policies;
}

export function getActionPolicy(action: Action): ActionPolicy | undefined {
  return actionRegistry.get(action);
}

/** Every declared action, sorted (BE1-R1: source of the `/me` capability list). */
export function listActions(): Action[] {
  return [...actionRegistry.keys()].sort();
}

/** Role-level capabilities of `principal`: every declared action `can` allows, sorted. */
export function capabilitiesFor(principal: Principal): Action[] {
  return listActions().filter((action) => can(principal, action));
}

/** Role-level capability (no resource). For UI capability maps; never a substitute for `check`. */
export function can(principal: Principal, action: Action): boolean {
  const policy = actionRegistry.get(action);
  if (!policy) return false;
  if (isSystemRole(principal.role)) {
    if (!policy.roles.includes(principal.role)) return false;
    if (principal.role === 'owner' && principal.sessionState !== 'active') return false;
    return true;
  }
  // Custom role: capability maps list only what the holder can execute now (privileged rows need the
  // holder's second factor, which the Principal does not carry; they are shown once it is verified).
  return customRoleVerdict(policy, principal.role, action, null) === 'allowed';
}

export function principalFromRequest(req: Request): Principal {
  const u = req.user;
  if (!u) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
  return { employeeId: u.id, role: u.role, sessionState: u.sessionState };
}

/** Marker on every `requireAction` middleware; read by the route guard check (`shared/routeGuard.ts`). */
export const ACCESS_GUARD = Symbol.for('udigity.requireAction');

/** The action guarded by `fn` when it is a `requireAction` middleware, else undefined. */
export function guardedAction(fn: unknown): Action | undefined {
  if (typeof fn !== 'function') return undefined;
  return (fn as unknown as Record<symbol, Action | undefined>)[ACCESS_GUARD];
}

/** Route middleware. Use after `authenticate`. Unknown actions are denied (fail closed). */
export function requireAction(action: Action) {
  const middleware = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
    const policy = actionRegistry.get(action);
    if (!policy) {
      console.error('Access: undeclared action denied', { action, requestId: req.requestId });
      return res.status(403).json({ error: 'Permission denied', code: 'FORBIDDEN_ROLE' });
    }
    const role = req.user.role;
    const forbidden = () => res.status(403).json({ error: 'Permission denied', code: 'FORBIDDEN_ROLE' });
    const secondFactor = () =>
      res.status(403).json({ error: 'Two-factor authentication must be completed first', code: 'OWNER_2FA_REQUIRED' });
    if (isSystemRole(role)) {
      // The matrix roles: the declaration is the whole answer. `role_permissions` never widens them.
      if (!policy.roles.includes(role)) return forbidden();
      const ownerOnly = policy.admin || (policy.roles.length === 1 && policy.roles[0] === 'owner');
      if (role === 'owner' && req.user.sessionState !== 'active' && ownerOnly) return secondFactor();
      return next();
    }
    // Custom role: nothing by default; only a validated grant, loaded from the database. The load is
    // awaited (cold process) so the answer is never "not loaded yet".
    const user = req.user;
    const decide = () => {
      const verdict = customRoleVerdict(policy, role, action, user);
      if (verdict === 'allowed') return next();
      if (verdict === 'second_factor_required') return secondFactor();
      return forbidden();
    };
    if (!dynamicRoleChecker) return forbidden();
    return dynamicRoleChecker.ensureReady().then(decide, (err: unknown) => {
      console.error('Access: custom-role grants could not be loaded; denying', { action, requestId: req.requestId, message: (err as Error)?.message });
      return forbidden();
    });
  };
  Object.defineProperty(middleware, ACCESS_GUARD, { value: action });
  return middleware;
}

/**
 * Route middleware when the action depends on the caller (e.g. deal finalize: Owner `deal.finalize`,
 * Developer `deal.update_stage`). `pick` must return one of `actions`; anything else is denied.
 * Marked like `requireAction` so the route guard check sees it.
 */
export function requireActionFor(pick: (req: Request) => Action, actions: readonly Action[]) {
  const byAction = new Map(actions.map((a) => [a, requireAction(a)]));
  const middleware = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
    const guard = byAction.get(pick(req));
    if (!guard) return res.status(403).json({ error: 'Permission denied', code: 'FORBIDDEN_ROLE' });
    return guard(req, res, next);
  };
  Object.defineProperty(middleware, ACCESS_GUARD, { value: actions.join('|') });
  return middleware;
}

/** Map a denial to the shared error contract. Denials carry no field values. */
export function assertAllowed(decision: AccessDecision): asserts decision is AccessAllowed {
  if (decision.allowed) return;
  if (decision.reason === 'not_found') throw notFound();
  if (decision.reason === 'hidden_by_policy') throw hiddenByPolicy();
  throw permissionDenied();
}

// ---------------------------------------------------------------------------
// Engine holder. BE2 calls `registerAccessEngine` from `modules/access/module.ts` init().
// ---------------------------------------------------------------------------

const DENY: AccessDecision = { allowed: false, reason: 'permission_denied' };

const denyAllEngine: AccessEngine = {
  async check() {
    return DENY;
  },
  async checkMany(_db, _principal, _action, resources) {
    return new Map(resources.map((r) => [r.id, DENY]));
  },
  scopeFilter() {
    return 'FALSE';
  },
};

let engine: AccessEngine = denyAllEngine;

export function registerAccessEngine(next: AccessEngine): void {
  engine = next;
}

/** Facade used by every module. */
export const access: AccessEngine = {
  check: (db, principal, action, resource) => engine.check(db, principal, action, resource),
  checkMany: (db, principal, action, resources) => engine.checkMany(db, principal, action, resources),
  scopeFilter: (principal, action, resourceType, options) => engine.scopeFilter(principal, action, resourceType, options),
};
