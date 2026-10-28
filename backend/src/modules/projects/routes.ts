/**
 * MOD-projects — HTTP routes. Owner: BE4. Mounted at /api/projects and /api/tasks (plan §4.1 + ORCH-2 (4)).
 * Pattern: authenticate -> requireAction -> idempotent -> Zod -> service (runCommand) -> JSON.
 * Status moves are commands (`POST /:id/status`), never a PATCH of `status`.
 */
import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { access, assertAllowed, principalFromRequest, requireAction, requireActionFor } from '../../shared/access.js';
import { runCommand } from '../../shared/tx.js';
import { auditOwnerHiddenRead } from '../access/schemas.js';
import { idempotent } from '../platform/idempotency.js';
import {
  AssignProjectDevelopersBody,
  CreateProjectBody,
  CreateTaskBody,
  IdParam,
  ListProjectsQuery,
  ListTasksQuery,
  ProjectStatusBody,
  ProvisionRetryBody,
  ReopenProjectBody,
  UpdateProjectBody,
  UpdateTaskBody,
} from './schemas.js';
import * as service from './service.js';

/** Mounted at /api/projects. */
const router = Router();

router.get('/', authenticate, requireAction('project.read'), async (req, res, next) => {
  try {
    const q = ListProjectsQuery.parse(req.query);
    res.json(await service.listProjects(pool, principalFromRequest(req), q));
  } catch (e) {
    next(e);
  }
});

// Manual provisioning (F2 false). No matrix row: gated by deal.update_stage, narrowed in the service ([BE4-R2]).
router.post('/', authenticate, requireAction('deal.update_stage'), idempotent('project.create_manual', { required: false }), async (req, res, next) => {
  try {
    const body = CreateProjectBody.parse(req.body);
    const project = await runCommand(req, (ctx) => service.createManualProject(ctx, body));
    res.status(201).json({ project });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', authenticate, requireAction('project.read'), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const principal = principalFromRequest(req);
    const decision = await access.check(pool, principal, 'project.read', { type: 'project', id });
    assertAllowed(decision);
    const project = await service.getProjectForReader(pool, principal, id);
    if (decision.ownerViewedHidden) await runCommand(req, (ctx) => auditOwnerHiddenRead(ctx, project.businessId));
    res.json({ project, access: decision.level });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', authenticate, requireAction('project.update_status'), idempotent('project.update', { required: false }), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const body = UpdateProjectBody.parse(req.body);
    res.json({ project: await runCommand(req, (ctx) => service.updateProject(ctx, id, body)) });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/status', authenticate, requireAction('project.update_status'), idempotent('project.update_status', { required: false }), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const body = ProjectStatusBody.parse(req.body);
    res.json({ project: await runCommand(req, (ctx) => service.changeProjectStatus(ctx, id, body)) });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/reopen', authenticate, requireAction('project.reopen_completed'), idempotent('project.reopen_completed', { required: false }), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const body = ReopenProjectBody.parse(req.body);
    res.json({ project: await runCommand(req, (ctx) => service.reopenProject(ctx, id, body)) });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/developers', authenticate, requireAction('project.assign_developers'), idempotent('project.assign_developers', { required: false }), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const body = AssignProjectDevelopersBody.parse(req.body);
    res.json({ project: await runCommand(req, (ctx) => service.setProjectDevelopers(ctx, id, body)) });
  } catch (e) {
    next(e);
  }
});

// `:id` is the DEAL id: the project does not exist yet (delivery-design §4, ORCH-2 (4)).
router.post('/:id/provision-retry', authenticate, requireAction('project.provision_retry'), idempotent('project.provision_retry', { required: false }), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    ProvisionRetryBody.parse(req.body ?? {});
    res.json(await runCommand(req, (ctx) => service.retryProvisioning(ctx, id)));
  } catch (e) {
    next(e);
  }
});

export default router;

/** Mounted at /api/tasks. Reading tasks uses `project.board.read` (no task.read matrix row). */
export const tasksRouter = Router();

tasksRouter.get('/', authenticate, requireAction('project.board.read'), async (req, res, next) => {
  try {
    const q = ListTasksQuery.parse(req.query);
    const principal = principalFromRequest(req);
    assertAllowed(await access.check(pool, principal, 'project.board.read', { type: 'project', id: q.projectId }));
    res.json(await service.listTasks(pool, principal, q.projectId, q.status));
  } catch (e) {
    next(e);
  }
});

tasksRouter.get('/:id', authenticate, requireAction('project.board.read'), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const principal = principalFromRequest(req);
    assertAllowed(await access.check(pool, principal, 'project.board.read', { type: 'task', id }));
    res.json({ task: await service.getTaskForReader(pool, principal, id) });
  } catch (e) {
    next(e);
  }
});

tasksRouter.post('/', authenticate, requireAction('task.create'), idempotent('task.create', { required: false }), async (req, res, next) => {
  try {
    const body = CreateTaskBody.parse(req.body);
    res.status(201).json({ task: await runCommand(req, (ctx) => service.createTask(ctx, body)) });
  } catch (e) {
    next(e);
  }
});

tasksRouter.patch(
  '/:id',
  authenticate,
  requireActionFor((req) => ((req.body as { status?: unknown } | undefined)?.status === 'done' ? 'task.complete' : 'task.update'), ['task.complete', 'task.update']),
  idempotent('task.update', { required: false }),
  async (req, res, next) => {
    try {
      const { id } = IdParam.parse(req.params);
      const body = UpdateTaskBody.parse(req.body);
      res.json({ task: await runCommand(req, (ctx) => service.updateTask(ctx, id, body)) });
    } catch (e) {
      next(e);
    }
  }
);
