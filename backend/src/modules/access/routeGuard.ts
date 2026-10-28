/**
 * MOD-access — route-guard audit (security review R2, authz-matrix §1 rule 1). Owner: BE2.
 *
 * Every mounted `/api` route must run a VT-3 guard (`requireAction` or a guard built on it) before its
 * handler. `unguardedRoutes(mounts)` walks the module routers and lists the routes without one.
 * A guard is recognised by the `accessAction` tag (guards built in this module) or by being a
 * `requireAction` closure (shared/access.ts). TL can call this at startup (REQUEST BE2-R4); BE2's own
 * mounts are asserted in tests.
 */
import type { RequestHandler, Router } from 'express';
import { ACCESS_GUARD, guardedAction, requireAction, type Action } from '../../shared/access.js';

export interface MountLike {
  path: string;
  router: Router;
}

export interface UnguardedRoute {
  mount: string;
  method: string;
  path: string;
}

type Tagged = RequestHandler & { accessAction?: string };

/** Tag a guard so the audit recognises it. */
export function tagGuard<T extends RequestHandler>(fn: T, action: string): T {
  (fn as Tagged).accessAction = action;
  // Also carry the shared marker so the TL start-up route audit (shared/routeGuard.ts) sees custom guards.
  if (!guardedAction(fn)) Object.defineProperty(fn, ACCESS_GUARD, { value: action });
  return fn;
}

/** `requireAction` with the audit tag. Prefer this in BE2 routers. */
export function guard(action: Action): RequestHandler {
  return tagGuard(requireAction(action), action);
}

const REQUIRE_ACTION_SOURCE = requireAction('x.y' as Action).toString();

export function isGuard(fn: unknown): boolean {
  if (typeof fn !== 'function') return false;
  if ((fn as Tagged).accessAction || guardedAction(fn)) return true;
  return fn.toString() === REQUIRE_ACTION_SOURCE;
}

interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle?: { stack?: Layer[] } & ((...args: unknown[]) => unknown);
}

/** Routes under the given mounts with no VT-3 guard in their handler chain (router-level `use` guards count). */
export function unguardedRoutes(mounts: readonly MountLike[], publicPaths: readonly string[] = []): UnguardedRoute[] {
  const out: UnguardedRoute[] = [];
  for (const m of mounts) {
    const stack = (m.router as unknown as { stack: Layer[] }).stack ?? [];
    let routerLevelGuard = false;
    for (const layer of stack) {
      if (!layer.route) {
        if (isGuard(layer.handle)) routerLevelGuard = true;
        continue;
      }
      const guarded = routerLevelGuard || layer.route.stack.some((s) => isGuard(s.handle));
      for (const method of Object.keys(layer.route.methods)) {
        const full = `${m.path}${layer.route.path === '/' ? '' : layer.route.path}`;
        if (!guarded && !publicPaths.includes(full)) out.push({ mount: m.path, method: method.toUpperCase(), path: full });
      }
    }
  }
  return out;
}
