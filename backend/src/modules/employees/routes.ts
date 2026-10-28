/**
 * MOD-employees — HTTP routes (SCR-OWN-002/003, SHR-006 read). Owner: BE1.
 * Employee is a non-business resource (plan §5): role rules via requireAction; the directory and
 * all commands are Owner only with completed 2FA (authz §3.2). Own profile: any role, own record.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAction } from '../../shared/access.js';
import { notFound } from '../../shared/errors.js';
import { toPage } from '../../shared/pagination.js';
import { runCommand } from '../../shared/tx.js';
import { revokeAllSessions } from '../identity/service.js';
import {
  CreateEmployeeSchema,
  EmployeeListQuerySchema,
  IdParamSchema,
  StatusBodySchema,
  UpdateEmployeeSchema,
} from './schemas.js';
import * as service from './service.js';

const router = Router();

const UpdateOwnProfileSchema = z.object({
  version: z.number().int().nonnegative(),
  phone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone number').nullable().optional(),
});

function sendOutcome(res: Response, outcome: service.CommandOutcome, okStatus = 200, wrap = false) {
  switch (outcome.kind) {
    case 'not_found':
      return res.status(404).json({ error: 'Employee not found', code: 'NOT_FOUND' });
    case 'conflict':
      return res.status(409).json({
        error: 'This employee was changed by someone else. Reload and try again.',
        code: 'VERSION_CONFLICT',
        // BL-09 (additive): `current` = the employee record as it is now.
        details: outcome.current ? { currentVersion: outcome.currentVersion, current: outcome.current } : { currentVersion: outcome.currentVersion },
        currentVersion: outcome.currentVersion, // Inc 1 shape, kept for existing clients
      });
    case 'email_taken':
      return res.status(409).json({
        error: 'An employee with this email already exists',
        code: 'CONFLICT_DUPLICATE',
        details: { email: ['Already in use'] },
      });
    case 'self':
      return res.status(409).json({ error: 'You cannot change your own role or deactivate your own account', code: 'CANNOT_DEACTIVATE_SELF' });
    case 'last_owner':
      return res.status(409).json({ error: 'The last active Owner cannot be deactivated or demoted', code: 'LAST_ACTIVE_OWNER' });
    case 'unchanged':
    case 'ok':
      return res.status(outcome.kind === 'ok' ? okStatus : 200).json(wrap ? { employee: outcome.employee } : outcome.employee);
  }
}

/**
 * Post-commit session revocation (SEQ-03, AR-04): a separate identity transaction so access ends at
 * once. The E-02 outbox consumer is the guaranteed retry; every request also re-reads status/role.
 */
async function revokeAfterCommit(employeeId: string, cause: 'account_deactivated' | 'role_changed', requestId?: string) {
  try {
    await withTransaction((tx) =>
      revokeAllSessions(tx, employeeId, cause === 'account_deactivated' ? 'account_deactivated' : 'revoked', {
        requestId,
        cause,
        sourceWorkflow: 'WF-EMP-001',
      })
    );
  } catch (err) {
    console.error('Inline session revocation failed; the E-02 consumer retries:', (err as Error).message);
  }
}

// GET /api/employees/me (all roles, own record)
router.get('/me', authenticate, requireAction('profile.read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employee = await service.getOwnProfile(pool, req.user!.id);
    if (!employee) throw notFound();
    return res.status(200).json({ employee });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/employees/me (all roles, own record)
router.patch('/me', authenticate, requireAction('profile.update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const body = UpdateOwnProfileSchema.parse(req.body);
    const outcome = await runCommand(req, (ctx) => service.updateEmployee(ctx, user.id, body));
    return sendOutcome(res, outcome, 200, true);
  } catch (error) {
    return next(error);
  }
});

// GET /api/employees (Owner) — paged, filters q/role/status.
router.get('/', authenticate, requireAction('employee.list'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = EmployeeListQuerySchema.parse(req.query);
    const { items, total } = await service.listEmployees(pool, q);
    // `employees` = Inc 1 shape, kept for existing clients.
    return res.status(200).json({ ...toPage(items, total, q), employees: items });
  } catch (error) {
    return next(error);
  }
});

// POST /api/employees (Owner) → E-01
router.post('/', authenticate, requireAction('employee.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateEmployeeSchema.parse(req.body);
    const outcome = await runCommand(req, (ctx) => service.createEmployee(ctx, body));
    return sendOutcome(res, outcome, 201);
  } catch (error) {
    return next(error);
  }
});

// GET /api/employees/:id (Owner)
router.get('/:id', authenticate, requireAction('employee.read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const employee = await service.getEmployee(pool, id);
    if (!employee) throw notFound();
    return res.status(200).json(employee);
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/employees/:id (Owner) — profile/role; role change → E-02
router.patch('/:id', authenticate, requireAction('employee.update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const body = UpdateEmployeeSchema.parse(req.body);
    const outcome = await runCommand(req, (ctx) => service.updateEmployee(ctx, id, body));
    if (outcome.kind === 'ok' && outcome.roleChanged) await revokeAfterCommit(id, 'role_changed', req.requestId);
    return sendOutcome(res, outcome);
  } catch (error) {
    return next(error);
  }
});

// GET /api/employees/:id/open-items (Owner) — before deactivation / role change (OWN-003)
router.get('/:id/open-items', authenticate, requireAction('employee.read_open_items'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = IdParamSchema.parse(req.params);
    if (!(await service.getEmployeeStatus(pool, id))) throw notFound();
    return res.status(200).json(await service.openItems(pool, id));
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/employees/:id/status (Owner: activate / deactivate) — SEQ-03 → E-02
router.patch(
  '/:id/status',
  authenticate,
  // Both directions are Owner-only admin actions; activate/deactivate share the policy.
  requireAction('employee.deactivate'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = IdParamSchema.parse(req.params);
      const body = StatusBodySchema.parse(req.body);
      const outcome = await runCommand(req, (ctx) => service.setEmployeeStatus(ctx, id, body));
      if (outcome.kind === 'ok' && !body.isActive) await revokeAfterCommit(id, 'account_deactivated', req.requestId);
      return sendOutcome(res, outcome, 200, true);
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
