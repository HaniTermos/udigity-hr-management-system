/**
 * MOD-access dynamic RBAC HTTP routes (SCR-OWN-012 Roles & Permissions Studio). Owner: BE2.
 * One mount: /api/access (the former duplicate /api/roles mount was removed, review 02 A-11).
 *
 * Every role command reloads the in-process grant cache AFTER `runCommand` has committed, never
 * inside the transaction (review 01 F-06 / 02 A-03).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAction } from '../../shared/access.js';
import { runCommand } from '../../shared/tx.js';
import { idempotent } from '../platform/idempotency.js';
import { CreateRoleSchema, UpdateRoleSchema } from './dynamicSchemas.js';
import * as dynamicService from './dynamicService.js';
import './schemas.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

const RoleIdParamSchema = z.object({ id: z.string().trim().min(1).max(50) }).strict();

/** Post-commit: refresh the grants this process answers from. A failed reload is logged; the TTL retries. */
async function reloadGrants(): Promise<void> {
  try {
    await dynamicService.dynamicRoleCache.reload(pool);
  } catch (err) {
    console.error('[access] grant cache reload after commit failed', { message: (err as Error).message });
  }
}

export const accessRouter = Router();

accessRouter.get(
  '/permissions',
  authenticate,
  requireAction('permission.list'),
  h(async (_req, res) => {
    res.json({ permissions: dynamicService.listPermissionsCatalog() });
  })
);

accessRouter.get(
  '/roles',
  authenticate,
  requireAction('role.list'),
  h(async (_req, res) => {
    res.json({ roles: await dynamicService.listRoles(pool) });
  })
);

accessRouter.get(
  '/roles/:id',
  authenticate,
  requireAction('role.read'),
  h(async (req, res) => {
    const { id } = RoleIdParamSchema.parse(req.params);
    res.json({ role: await dynamicService.getRole(pool, id) });
  })
);

accessRouter.post(
  '/roles',
  authenticate,
  requireAction('role.create'),
  idempotent('role.create', { required: false }),
  h(async (req, res) => {
    const input = CreateRoleSchema.parse(req.body);
    const role = await runCommand(req, (ctx) => dynamicService.createRole(ctx, input));
    await reloadGrants();
    res.status(201).json({ role });
  })
);

accessRouter.patch(
  '/roles/:id',
  authenticate,
  requireAction('role.update'),
  idempotent('role.update', { required: false }),
  h(async (req, res) => {
    const { id } = RoleIdParamSchema.parse(req.params);
    const input = UpdateRoleSchema.parse(req.body);
    const role = await runCommand(req, (ctx) => dynamicService.updateRole(ctx, id, input));
    await reloadGrants();
    res.json({ role });
  })
);

accessRouter.delete(
  '/roles/:id',
  authenticate,
  requireAction('role.delete'),
  h(async (req, res) => {
    const { id } = RoleIdParamSchema.parse(req.params);
    await runCommand(req, (ctx) => dynamicService.deleteRole(ctx, id));
    await reloadGrants();
    res.status(204).end();
  })
);

export default accessRouter;
