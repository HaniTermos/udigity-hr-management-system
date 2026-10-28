/**
 * Module definition contract (plan.md §2). Owner: Tech Lead.
 * Each module folder has a `module.ts` that default-exports one ModuleDefinition. The owning agent
 * edits only its own `module.ts`; `modules/index.ts` (TL) lists every module once.
 */
import type { Router } from 'express';

export type BackendAgent = 'BE1' | 'BE2' | 'BE3' | 'BE4' | 'BE5';

export interface ModuleMount {
  /** Absolute mount path, e.g. `/api/businesses`. Must be unique across modules. */
  path: string;
  router: Router;
}

export interface ModuleDefinition {
  /** Folder name under `src/modules/`, e.g. `businesses`. */
  name: string;
  /** Architecture module id, e.g. `MOD-business`. */
  archId: string;
  owner: BackendAgent;
  mounts: ModuleMount[];
  /**
   * Runs once at startup (API and worker) before routes are mounted. Register the access engine,
   * outbox writer/consumers and job handlers here. Must not do I/O.
   */
  init?: () => void;
}
