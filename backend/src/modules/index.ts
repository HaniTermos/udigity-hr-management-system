/**
 * Module registry (plan.md §2). Owner: Tech Lead. Created once; agents edit only their own module.ts.
 * Order is the dependency order of arch-a §3.2.1 (platform/admin first, sinks last). init() hooks run
 * in this order, then every mount is attached.
 */
import type { Express } from 'express';
import type { ModuleDefinition } from '../shared/module.js';
import { config } from '../config/index.js';
import { enforceRouteGuards } from '../shared/routeGuard.js';
import platformModule from './platform/module.js';
import adminModule from './admin/module.js';
import employeesModule from './employees/module.js';
import identityModule from './identity/module.js';
import accessModule from './access/module.js';
import duplicatesModule from './duplicates/module.js';
import reservationModule from './reservation/module.js';
import dealsModule from './deals/module.js';
import callsModule from './calls/module.js';
import businessesModule from './businesses/module.js';
import correctionsModule from './corrections/module.js';
import assignmentModule from './assignment/module.js';
import workModule from './work/module.js';
import attendanceModule from './attendance/module.js';
import meetingsModule from './meetings/module.js';
import projectsModule from './projects/module.js';
import notificationsModule from './notifications/module.js';
import reportsModule from './reports/module.js';

export const modules: readonly ModuleDefinition[] = [
  platformModule,
  adminModule,
  employeesModule,
  identityModule,
  accessModule,
  duplicatesModule,
  reservationModule,
  dealsModule,
  callsModule,
  businessesModule,
  correctionsModule,
  assignmentModule,
  workModule,
  attendanceModule,
  meetingsModule,
  projectsModule,
  notificationsModule,
  reportsModule,
];

let initialised = false;

/** Run every module's init() once (API and worker). */
export function initModules(): void {
  if (initialised) return;
  initialised = true;
  for (const m of modules) m.init?.();
}

/** init() + mount every module router. Throws on a duplicate mount path. */
export function registerModules(app: Express): void {
  initModules();
  const seen = new Set<string>();
  for (const m of modules) {
    for (const mount of m.mounts) {
      if (seen.has(mount.path)) throw new Error(`Duplicate mount path ${mount.path} (module ${m.name})`);
      seen.add(mount.path);
      app.use(mount.path, mount.router);
    }
  }
  // SEC review R2: every /api route has requireAction (allowlist in shared/routeGuard.ts).
  // Production refuses to start; development logs; test is covered by src/tests/routeGuard.test.ts.
  if (config.env !== 'test') enforceRouteGuards(modules, { strict: config.isProduction });
}
