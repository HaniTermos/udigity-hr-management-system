/**
 * MOD-notifications — HTTP routes. Owner: BE5.
 * Mounted at /api/notifications and /api/delivery-monitor.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { principalFromRequest, requireAction } from '../../shared/access.js';
import { pool } from '../../db/pool.js';
import { runCommand } from '../../shared/tx.js';
import { PageQuerySchema, toPage } from '../../shared/pagination.js';
import { mailSink } from './transport.js';
import { MarkReadParamSchema, ReminderParamSchema } from './schemas.js';
import * as service from './service.js';

/** Mounted at /api/notifications */
const router = Router();

router.get('/', authenticate, requireAction('notification.list'), async (req, res, next) => {
  try {
    const principal = principalFromRequest(req);
    const unreadOnly = req.query.unreadOnly === 'true' || req.query.unread === 'true';
    const pagination = PageQuerySchema.parse(req.query);
    const { items, total } = await service.listMyNotifications(pool, principal, {
      unreadOnly,
      limit: pagination.pageSize,
      offset: (pagination.page - 1) * pagination.pageSize,
    });
    res.json(toPage(items, total, pagination));
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', authenticate, requireAction('notification.list'), async (req, res, next) => {
  try {
    const principal = principalFromRequest(req);
    const unreadCount = await service.getMyUnreadCount(pool, principal);
    res.json({ unreadCount });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/read', authenticate, requireAction('notification.mark_read'), async (req, res, next) => {
  try {
    const principal = principalFromRequest(req);
    const { id } = MarkReadParamSchema.parse(req.params);
    await service.markAsRead(pool, principal, id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', authenticate, requireAction('notification.mark_read'), async (req, res, next) => {
  try {
    const principal = principalFromRequest(req);
    const count = await service.markAllAsRead(pool, principal);
    res.json({ ok: true, markedCount: count });
  } catch (err) {
    next(err);
  }
});

export default router;

/** Optional `state` filter of the delivery monitor (unknown values are ignored). */
const MONITOR_STATES = ['pending', 'retry_pending', 'sent', 'accepted', 'captured', 'failed', 'suppressed', 'skipped', 'scheduled', 'cancelled'];

/** Mounted at /api/delivery-monitor */
export const deliveryMonitorRouter = Router();

deliveryMonitorRouter.get('/', authenticate, requireAction('reminder.monitor.read'), async (req, res, next) => {
  try {
    const kind = req.query.kind as 'reminder' | 'notification' | 'provisioning' | undefined;
    const state = typeof req.query.state === 'string' && MONITOR_STATES.includes(req.query.state) ? req.query.state : undefined;
    const pagination = PageQuerySchema.parse(req.query);
    const { items, total } = await service.listDeliveryMonitor(pool, {
      kind: kind && ['reminder', 'notification', 'provisioning'].includes(kind) ? kind : undefined,
      state,
      limit: pagination.pageSize,
      offset: (pagination.page - 1) * pagination.pageSize,
    });
    res.json(toPage(items, total, pagination));
  } catch (err) {
    next(err);
  }
});

deliveryMonitorRouter.post('/reminders/:id/send-again', authenticate, requireAction('reminder.send_again'), async (req, res, next) => {
  try {
    const { id } = ReminderParamSchema.parse(req.params);
    const out = await runCommand(req, (ctx) => service.retryMonitorItem(ctx, id));
    res.json({ ok: true, kind: out.kind, message: 'Item queued for immediate retry' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// QA-2 readable mail sink. Mounted at /api/test-support/mail ONLY when NODE_ENV=test (module.ts).
// ---------------------------------------------------------------------------
export const testMailRouter = Router();

testMailRouter.get('/', (req, res) => {
  const to = typeof req.query.to === 'string' ? req.query.to.toLowerCase() : null;
  const messages = mailSink.messages().filter((m) => !to || m.to.toLowerCase() === to);
  res.json({ messages: messages.map(({ raw: _raw, ...m }) => m) });
});

testMailRouter.delete('/', (_req, res) => {
  mailSink.clear();
  res.json({ cleared: true });
});
