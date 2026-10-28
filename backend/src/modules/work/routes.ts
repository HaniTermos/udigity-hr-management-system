/**
 * MOD-work — HTTP routes. Owner: BE1.
 * Mounted at /api/targets and /api/work-items.
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { principalFromRequest, requireAction } from '../../shared/access.js';
import { pool } from '../../db/pool.js';
import { toPage } from '../../shared/pagination.js';
import * as service from './service.js';
import { CreateTargetSchema, CreateWorkItemSchema, TargetsQuerySchema, UpdateTargetSchema, UpdateWorkItemSchema, WorkItemsQuerySchema } from './schemas.js';

const IdParamSchema = z.object({ id: z.string().uuid() }).strict();

/** Mounted at /api/targets */
export const targetsRouter = Router();

targetsRouter.get('/', authenticate, requireAction('target.read'), async (req, res, next) => {
  try {
    const principal = principalFromRequest(req);
    const pagination = TargetsQuerySchema.parse(req.query);
    const { items, total } = await service.listTargets(pool, principal, {
      employeeId: pagination.scope === 'self' ? principal.employeeId : pagination.employeeId,
      limit: pagination.pageSize,
      offset: (pagination.page - 1) * pagination.pageSize,
    });
    res.json(toPage(items, total, pagination));
  } catch (err) {
    next(err);
  }
});

targetsRouter.post('/', authenticate, requireAction('target.set'), async (req, res, next) => {
  try {
    const input = CreateTargetSchema.parse(req.body);
    const target = await service.createTarget(req, input);
    res.status(201).json(target);
  } catch (err) {
    next(err);
  }
});

targetsRouter.patch('/:id', authenticate, requireAction('target.set'), async (req, res, next) => {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const input = UpdateTargetSchema.parse(req.body);
    const target = await service.updateTarget(req, id, input);
    res.json(target);
  } catch (err) {
    next(err);
  }
});

/** Mounted at /api/work-items */
export const workItemsRouter = Router();

workItemsRouter.get('/', authenticate, requireAction('work_item.read'), async (req, res, next) => {
  try {
    const principal = principalFromRequest(req);
    const q = WorkItemsQuerySchema.parse(req.query);
    const pagination = { page: q.page, pageSize: q.limit ?? q.pageSize ?? 25 };
    const { items, total } = await service.listWorkItems(pool, principal, {
      status: q.status,
      openOnly: q.state === 'open',
      limit: pagination.pageSize,
      offset: (pagination.page - 1) * pagination.pageSize,
    });
    res.json(toPage(items, total, pagination));
  } catch (err) {
    next(err);
  }
});

workItemsRouter.post('/', authenticate, requireAction('work_item.create'), async (req, res, next) => {
  try {
    const input = CreateWorkItemSchema.parse(req.body);
    const item = await service.createWorkItem(req, input);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

workItemsRouter.patch('/:id', authenticate, requireAction('work_item.update'), async (req, res, next) => {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const input = UpdateWorkItemSchema.parse(req.body);
    const item = await service.updateWorkItem(req, id, input);
    res.json(item);
  } catch (err) {
    next(err);
  }
});
