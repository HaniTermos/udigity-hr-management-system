/**
 * MOD-meetings — HTTP routes. Owner: BE4. Mounted at /api/meetings (plan §4.1).
 * GET / (range ≤ 62 days), GET /:id, POST / (schedule), PATCH /:id (reschedule),
 * POST /:id/{held,missed,cancel} (record outcome / cancel). Every change carries `version`.
 */
import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { access, assertAllowed, principalFromRequest, requireAction } from '../../shared/access.js';
import { notFound } from '../../shared/errors.js';
import { findOpenForBusiness } from '../deals/repo.js';
import { getDealSummary } from '../deals/service.js';
import { runCommand } from '../../shared/tx.js';
import { auditOwnerHiddenRead } from '../access/schemas.js';
import { idempotent } from '../platform/idempotency.js';
import {
  AttendeeOptionsQuery,
  CreateMeetingBody,
  IdParam,
  ListMeetingsQuery,
  MeetingCancelBody,
  MeetingHeldBody,
  MeetingMissedBody,
  RescheduleMeetingBody,
} from './schemas.js';
import * as repo from './repo.js';
import * as service from './service.js';

/** Mounted at /api/meetings. */
const router = Router();

router.get('/', authenticate, requireAction('meeting.read'), async (req, res, next) => {
  try {
    const q = ListMeetingsQuery.parse(req.query);
    res.json(await service.listMeetings(pool, principalFromRequest(req), q));
  } catch (e) {
    next(e);
  }
});

/**
 * FX-BE-C3: the attendee picker for anyone who may schedule (Owner, Call Center, Developer), so the
 * schedule drawer no longer needs the Owner-only GET /api/employees. Registered before `/:id`.
 *
 * Review 2026-11-04 E-07 (matrix §3.2 "Directory is Owner only"): the Owner gets every active employee.
 * Everyone else gets only the people relevant to the meeting: the Owners, themselves and, for the
 * deal (`dealId`, or the open deal of `businessId`, which the caller must be able to schedule on), its
 * assigned Developer and the business's current Call Center agent. A deal with no Developer yet also
 * lists the active Developers (scheduling one assigns them, as GET /api/deals/developers already shows).
 * Response shape unchanged: `{ items: [{ id, fullName, role }], total }`.
 */
router.get('/attendee-options', authenticate, requireAction('meeting.create'), async (req, res, next) => {
  try {
    const q = AttendeeOptionsQuery.parse(req.query);
    const principal = principalFromRequest(req);
    let limitTo: { ids: string[]; roles: string[] } | undefined;
    if (principal.role !== 'owner') {
      limitTo = { ids: [principal.employeeId], roles: ['owner'] };
      let deal: Awaited<ReturnType<typeof getDealSummary>> = null;
      if (q.dealId) {
        deal = await getDealSummary(pool, q.dealId);
        if (!deal || (q.businessId && q.businessId !== deal.businessId)) throw notFound();
      } else if (q.businessId) {
        assertAllowed(await access.check(pool, principal, 'business.read', { type: 'business', id: q.businessId }));
        const open = await findOpenForBusiness(pool, q.businessId);
        deal = open ? await getDealSummary(pool, open.id) : null;
      }
      if (deal) {
        assertAllowed(await access.check(pool, principal, 'meeting.create', { type: 'deal', id: deal.id }));
        if (deal.assignedDeveloperId) limitTo.ids.push(deal.assignedDeveloperId);
        else if (principal.role === 'call_center') limitTo.roles.push('developer');
        const agent = await repo.currentAssigneeOf(pool, deal.businessId);
        if (agent) limitTo.ids.push(agent);
      }
    }
    const rows = await repo.attendeeOptions(pool, q, limitTo);
    res.json({ items: rows.map((r) => ({ id: r.id, fullName: r.full_name, role: r.role })), total: rows.length });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', authenticate, requireAction('meeting.read'), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const principal = principalFromRequest(req);
    const decision = await access.check(pool, principal, 'meeting.read', { type: 'meeting', id });
    assertAllowed(decision);
    const meeting = await service.getMeetingForReader(pool, principal, id);
    if (decision.ownerViewedHidden) await runCommand(req, (ctx) => auditOwnerHiddenRead(ctx, meeting.businessId));
    res.json({ meeting, access: decision.level });
  } catch (e) {
    next(e);
  }
});

router.post('/', authenticate, requireAction('meeting.create'), idempotent('meeting.create', { required: false }), async (req, res, next) => {
  try {
    const body = CreateMeetingBody.parse(req.body);
    const meeting = await runCommand(req, (ctx) => service.createMeeting(ctx, body));
    res.status(201).json({ meeting });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', authenticate, requireAction('meeting.reschedule'), idempotent('meeting.reschedule', { required: false }), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const body = RescheduleMeetingBody.parse(req.body);
    res.json({ meeting: await runCommand(req, (ctx) => service.rescheduleMeeting(ctx, id, body)) });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/held', authenticate, requireAction('meeting.complete'), idempotent('meeting.complete', { required: false }), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const body = MeetingHeldBody.parse(req.body);
    res.json({ meeting: await runCommand(req, (ctx) => service.markHeld(ctx, id, body)) });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/missed', authenticate, requireAction('meeting.mark_missed'), idempotent('meeting.mark_missed', { required: false }), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const body = MeetingMissedBody.parse(req.body);
    res.json({ meeting: await runCommand(req, (ctx) => service.markMissed(ctx, id, body)) });
  } catch (e) {
    next(e);
  }
});

// No matrix row for cancel yet: gated by meeting.reschedule (same roles) — Security REQUEST [BE4-R2].
router.post('/:id/cancel', authenticate, requireAction('meeting.reschedule'), idempotent('meeting.cancel', { required: false }), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const body = MeetingCancelBody.parse(req.body);
    res.json({ meeting: await runCommand(req, (ctx) => service.cancelMeeting(ctx, id, body)) });
  } catch (e) {
    next(e);
  }
});

export default router;
