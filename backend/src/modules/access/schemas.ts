/**
 * MOD-access — contract surface for other modules. Owner: BE2.
 * MOD-access has no HTTP routes and declares no actions of its own; the VT-3 declarations harness
 * (matrix.ts) is what modules use to declare theirs:
 *
 *   import { defineMatrixActions } from '../access/schemas.js';
 *   export const ACTIONS = defineMatrixActions(['business.list', 'business.read', ...] as const);
 */
export { AUTHZ_MATRIX, defineMatrixActions, matrixPolicy, verifyDeclaredActions, type MatrixRow } from './matrix.js';
import { defineMatrixActions } from './matrix.js';

export const ACCESS_ACTIONS = defineMatrixActions([
  'role.list',
  'role.read',
  'role.create',
  'role.update',
  'role.delete',
  'permission.list',
] as const);

export { ACCESS_FACT_COLUMNS, DEAL_STAGE_ACCEPTED, DEAL_STAGE_CLOSED, PROJECT_STATUS_COMPLETED } from './rules.js';
export {
  registerResourceResolver,
  auditOwnerHiddenRead,
  duplicateRevelation,
  hiddenForOthersPredicate,
  refreshAccessSettings,
  setRuleFlagOverridesForTests,
  OWNER_VIEWED_HIDDEN_EVENT,
  type ResolvedResource,
  type ResourceResolver,
} from './service.js';
export { guard, tagGuard, unguardedRoutes } from './routeGuard.js';
