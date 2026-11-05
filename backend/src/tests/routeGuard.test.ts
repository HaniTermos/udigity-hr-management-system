/**
 * SEC review R2 (TL): every mounted /api route runs requireAction before its handler, except the
 * allowlist in shared/routeGuard.ts. No database needed.
 */
import { describe, expect, it } from 'vitest';
import express, { type RequestHandler } from 'express';
import { defineActions, requireAction, requireActionFor, type Action } from '../shared/access.js';
import {
  ROUTE_GUARD_ALLOWLIST,
  enforceRouteGuards,
  findUnguardedRoutes,
  formatRoutes,
  listRoutes,
} from '../shared/routeGuard.js';
import { modules } from '../modules/index.js';

const ok: RequestHandler = (_req, res) => {
  res.json({ ok: true });
};

defineActions({ 'tlguard.read': { roles: ['owner'] }, 'tlguard.write': { roles: ['owner'] } });

describe('shared/routeGuard', () => {
  it('detects guarded, unguarded, router-level, nested and requireActionFor routes', () => {
    const router = express.Router();
    router.get('/open', ok);
    router.get('/guarded', requireAction('tlguard.read' as Action), ok);
    router.post('/picked', requireActionFor(() => 'tlguard.write' as Action, ['tlguard.write' as Action]), ok);
    // A guard as the LAST handler does not protect anything.
    router.get('/guard-last', ok, requireAction('tlguard.read' as Action));
    const nested = express.Router();
    nested.get('/inner', ok);
    router.use('/sub/:id', nested);
    router.use(requireAction('tlguard.read' as Action));
    router.delete('/after-use', ok);

    const routes = listRoutes([{ name: 'fake', mounts: [{ path: '/api/fake', router }] }]);
    const byKey = new Map(routes.map((r) => [`${r.method} ${r.path}`, r.guarded]));
    expect(byKey.get('GET /api/fake/open')).toBe(false);
    expect(byKey.get('GET /api/fake/guarded')).toBe(true);
    expect(byKey.get('POST /api/fake/picked')).toBe(true);
    expect(byKey.get('GET /api/fake/guard-last')).toBe(false);
    expect(byKey.get('GET /api/fake/sub/:id/inner')).toBe(false);
    expect(byKey.get('DELETE /api/fake/after-use')).toBe(true);
  });

  it('honours the allowlist (exact and prefix) and fails strict mode', () => {
    const router = express.Router();
    router.post('/login', ok);
    router.get('/sessions', ok);
    const mods = [{ name: 'fake', mounts: [{ path: '/api/auth', router }] }];
    expect(findUnguardedRoutes(mods).map((r) => `${r.method} ${r.path}`)).toEqual(['GET /api/auth/sessions']);
    expect(findUnguardedRoutes(mods, [...ROUTE_GUARD_ALLOWLIST, '* /api/auth/*'])).toEqual([]);
    expect(() => enforceRouteGuards(mods, { strict: true })).toThrow(/GET \/api\/auth\/sessions/);
    const logged: string[] = [];
    expect(enforceRouteGuards(mods, { strict: false, log: (m) => logged.push(m) })).toHaveLength(1);
    expect(logged[0]).toMatch(/Unguarded/);
  });

  it('every mounted /api route of the real module registry has requireAction (or is allowlisted)', () => {
    const unguarded = findUnguardedRoutes(modules);
    expect(unguarded, formatRoutes(unguarded)).toEqual([]);
    // Sanity: the walker actually sees the registry's routes.
    expect(listRoutes(modules).length).toBeGreaterThan(20);
  });

  it('every allowlist entry still matches a real route (no stale exceptions)', () => {
    const routes = listRoutes(modules);
    for (const entry of ROUTE_GUARD_ALLOWLIST) {
      const [method, pattern] = entry.split(' ');
      const hit = routes.some((r) =>
        (method === '*' || r.method === method) &&
        (pattern.endsWith('/*') ? r.path.startsWith(pattern.slice(0, -1)) : r.path === pattern)
      );
      expect(hit, entry).toBe(true);
    }
  });
});
