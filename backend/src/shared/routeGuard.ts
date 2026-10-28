/**
 * Route guard check (security review R2, authz-matrix §1 rule 1, plan §4.2/§4.9). Owner: Tech Lead.
 *
 * Every mounted `/api` route must run a VT-3 guard (`requireAction` / `requireActionFor`, or a guard
 * built on them such as BE2's `guard()`) before its handler. The only exceptions are the routes in
 * `ROUTE_GUARD_ALLOWLIST`: pre-authentication and session-bootstrap endpoints that cannot have an
 * action (login, 2FA steps, logout, `/me`, password reset) and the QA-2 test-support mounts, which
 * exist only when NODE_ENV=test.
 *
 * - CI: `src/tests/routeGuard.test.ts` asserts `findUnguardedRoutes(modules)` is empty.
 * - Startup: `registerModules` calls `enforceRouteGuards`; production refuses to start with an
 *   unguarded route, dev/test log it (so one agent's in-progress router cannot break everyone's tests).
 *
 * Recognised guards: functions carrying the `ACCESS_GUARD` marker (`shared/access.ts`) or the BE2
 * `accessAction` tag (`modules/access/routeGuard.ts`). A guard counts when it is a router-level `use`
 * middleware registered before the route, or any handler in the route's chain except the last one.
 */
import type { Router } from 'express';
import { guardedAction } from './access.js';

export interface MountLike {
  path: string;
  router: Router;
}

export interface ModuleLike {
  name: string;
  mounts: readonly MountLike[];
}

export interface RouteInfo {
  module: string;
  method: string;
  /** Full path including the mount, e.g. `/api/deals/:id/reopen`. */
  path: string;
  guarded: boolean;
}

/** `METHOD /full/path` entries allowed without a VT-3 guard. `*` method = any; trailing `/*` = prefix. */
export const ROUTE_GUARD_ALLOWLIST: readonly string[] = [
  // Identity (BE1): before or during sign-in, or session-only endpoints (authenticate covers them).
  'POST /api/auth/login',
  'POST /api/auth/2fa/verify',
  'POST /api/auth/2fa/recover',
  'POST /api/auth/2fa/enroll/start',
  'POST /api/auth/2fa/enroll/confirm',
  'GET /api/auth/2fa/status',
  'POST /api/auth/logout',
  'GET /api/auth/me',
  'POST /api/auth/password-reset/request',
  'POST /api/auth/password-reset/complete',
  // QA-2 test support: mounted only when NODE_ENV=test (platform, notifications module.ts).
  '* /api/test-support/*',
];

interface Layer {
  route?: { path: string | string[]; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle?: unknown;
  regexp?: RegExp & { fast_slash?: boolean };
  keys?: { name: string | number }[];
}

export function isGuardHandler(fn: unknown): boolean {
  if (typeof fn !== 'function') return false;
  if (guardedAction(fn)) return true;
  return Boolean((fn as { accessAction?: unknown }).accessAction);
}

/** Best-effort path of a nested `router.use('/prefix', subRouter)` layer (Express 4 keeps only a RegExp). */
function nestedPrefix(layer: Layer): string {
  const re = layer.regexp;
  if (!re || re.fast_slash) return '';
  let keyIndex = 0;
  const src = re.source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    // Express 4 param segment: `(?:\/([^/]+?))` (optional params end in `?`).
    .replace(/\(\?:\\\/\(\[\^\\?\/\]\+\?\)\)\??/g, () => `/:${String(layer.keys?.[keyIndex++]?.name ?? 'param')}`)
    .replace(/\\\//g, '/');
  return src === '/' ? '' : src;
}

function joinPath(base: string, path: string): string {
  if (path === '/' || path === '') return base || '/';
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

function walk(router: unknown, base: string, inheritedGuard: boolean, module: string, out: RouteInfo[]): void {
  const stack = ((router as { stack?: Layer[] }).stack ?? []) as Layer[];
  let routerGuard = inheritedGuard;
  for (const layer of stack) {
    const route = layer.route;
    if (route) {
      const handlers = route.stack.map((s) => s.handle);
      const guarded = routerGuard || handlers.slice(0, -1).some(isGuardHandler);
      const paths = Array.isArray(route.path) ? route.path : [route.path];
      const methods = Object.keys(route.methods).filter((m) => route.methods[m]);
      for (const p of paths) {
        for (const method of methods) {
          out.push({ module, method: method.toUpperCase(), path: joinPath(base, String(p)), guarded });
        }
      }
      continue;
    }
    const handle = layer.handle as { stack?: unknown } | undefined;
    if (handle && Array.isArray(handle.stack)) {
      walk(handle, joinPath(base, nestedPrefix(layer)), routerGuard, module, out);
      continue;
    }
    // Router-level middleware applies to every route registered after it.
    if (isGuardHandler(layer.handle)) routerGuard = true;
  }
}

/** Every route of every mount, with whether a VT-3 guard runs before its handler. */
export function listRoutes(modules: readonly ModuleLike[]): RouteInfo[] {
  const out: RouteInfo[] = [];
  for (const m of modules) for (const mount of m.mounts) walk(mount.router, mount.path, false, m.name, out);
  return out;
}

function matchesEntry(route: RouteInfo, entry: string): boolean {
  const [method, pattern] = entry.split(' ', 2);
  if (!pattern) return false;
  if (method !== '*' && method !== route.method) return false;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return route.path === prefix || route.path.startsWith(`${prefix}/`);
  }
  return pattern === route.path;
}

export function isAllowlisted(route: RouteInfo, allowlist: readonly string[] = ROUTE_GUARD_ALLOWLIST): boolean {
  return allowlist.some((entry) => matchesEntry(route, entry));
}

/** `/api` routes that have no guard and are not allowlisted. Empty = compliant. */
export function findUnguardedRoutes(
  modules: readonly ModuleLike[],
  allowlist: readonly string[] = ROUTE_GUARD_ALLOWLIST
): RouteInfo[] {
  return listRoutes(modules).filter((r) => r.path.startsWith('/api') && !r.guarded && !isAllowlisted(r, allowlist));
}

export function formatRoutes(routes: readonly RouteInfo[]): string {
  return routes.map((r) => `${r.method} ${r.path} (module ${r.module})`).join('; ');
}

/**
 * Startup check. `strict` (production) throws, so the API refuses to start; otherwise one error line
 * is logged and the CI test (not a crash) reports in-progress modules.
 */
export function enforceRouteGuards(
  modules: readonly ModuleLike[],
  options: { strict: boolean; log?: (message: string) => void } = { strict: false }
): RouteInfo[] {
  const unguarded = findUnguardedRoutes(modules);
  if (unguarded.length === 0) return unguarded;
  const message = `Unguarded /api routes (no requireAction): ${formatRoutes(unguarded)}`;
  if (options.strict) throw new Error(message);
  (options.log ?? console.error)(message);
  return unguarded;
}
