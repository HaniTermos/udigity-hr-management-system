import type { ModuleDefinition } from '../../shared/module.js';
import { listActions, registerAccessEngine } from '../../shared/access.js';
import { pool } from '../../db/pool.js';
import { verifyDeclaredActions } from './matrix.js';
import { accessEngine } from './service.js';
import { dynamicRoleCache } from './dynamicService.js';
import { accessRouter } from './routes.js';

const definition: ModuleDefinition = {
  name: 'access',
  archId: 'MOD-access',
  owner: 'BE2',
  mounts: [{ path: '/api/access', router: accessRouter }],
  init() {
    // Replaces the fail-closed holder (shared/access.ts) with the real engine.
    registerAccessEngine(accessEngine);
    // VT-3 harness: every DECLARED action (the registry, not the matrix keys; security review R2) is compared
    // with docs/security/authz-matrix.md. Role/admin drift = startup error; a name the matrix lacks is logged.
    verifyDeclaredActions(listActions());
    // Custom-role grants (migration 014): attach the pool and start the first load. Nothing blocks here;
    // `requireAction` awaits the load for custom-role requests, so a cold process never answers "unloaded".
    dynamicRoleCache.attach(pool);
  },
};

export default definition;
