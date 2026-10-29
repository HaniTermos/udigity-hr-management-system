/**
 * MOD-attendance — HTTP routes, mounted at /api/attendance. Owner: BE1. Contract: BE1-C2.
 * Pattern: authenticate -> requireAction(<matrix action>) -> Zod parse -> service (runCommand) -> JSON.
 * Single resources go through access.check (attendance_session / attendance_correction resolvers),
 * lists through access.scopeFilter (Owner all, others own; matrix `attendance.read`).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { can, principalFromRequest, requireAction, requireActionFor } from '../../shared/access.js';
import { DEMO_LABEL } from '../../shared/flags.js';
import { notFound, ruleViolation } from '../../shared/errors.js';
import { runCommand } from '../../shared/tx.js';
import { idempotent } from '../platform/idempotency.js';
import {
  A,
  AdjustSchema,
  CancelDayOffSchema,
  CheckInSchema,
  CheckOutSchema,
  CorrectionRequestSchema,
  CorrectionsQuerySchema,
  CreateDayOffSchema,
  DaysOffQuerySchema,
  EndBreakSchema,
  GrantRemoteSchema,
  IdParamSchema,
  MySessionsQuerySchema,
  OverviewQuerySchema,
  PutEmployeeScheduleSchema,
  PutSettingsSchema,
  RejectCorrectionSchema,
  RemoteDecisionSchema,
  RemoteQuerySchema,
  RequestRemoteSchema,
  ResolveReviewSchema,
  RetroactiveSchema,
  SessionsQuerySchema,
  StartBreakSchema,
  TestOfficeCheckSchema,
  VersionReasonSchema,
  WithdrawSchema,
} from './schemas.js';
import * as service from './service.js';

/** Mounted at /api/attendance. */
const router = Router();

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------- employee (own)

router.get('/me/today', authenticate, requireAction(A.read), h(async (req, res) => {
  res.json(await service.getToday(pool, principalFromRequest(req)));
}));

router.get('/me/sessions', authenticate, requireAction(A.read), h(async (req, res) => {
  const q = MySessionsQuerySchema.parse(req.query);
  res.json(await service.mySessions(pool, principalFromRequest(req), q));
}));

router.post('/check-in', authenticate, requireAction(A.checkIn), idempotent('attendance.check_in', { required: false }), h(async (req, res) => {
  CheckInSchema.parse(req.body ?? {});
  const outcome = await runCommand(req, (ctx) => service.checkIn(ctx));
  // The failed attempt is audited in the committed transaction; then 422 (AC-ATT-005).
  if (outcome.kind === 'office_failed') {
    throw ruleViolation(
      outcome.hostnamesUnresolved
        ? 'Office check failed: the office network address (dynamic DNS) could not be confirmed. Try again shortly or ask the Owner.'
        : 'Office check failed: check in from the office network',
      { reason: 'OFFICE_CHECK_FAILED', mode: outcome.mode, hostnamesUnresolved: outcome.hostnamesUnresolved }
    );
  }
  res.status(201).json({ session: outcome.session, outcome: 'checked_in', label: DEMO_LABEL });
}));

router.post('/check-out', authenticate, requireAction(A.checkOut), idempotent('attendance.check_out', { required: false }), h(async (req, res) => {
  const body = CheckOutSchema.parse(req.body ?? {});
  // D5: a failed office check closes provisionally (pinned); there is no blocked outcome any more.
  const outcome = await runCommand(req, (ctx) => service.checkOut(ctx, body));
  res.json({ session: outcome.session, outcome: outcome.outcome, label: DEMO_LABEL });
}));

// ---------------------------------------------------------------- breaks (Wave 2)

/** Fixed v1 scope "no break tracking": every break route is 404 while CFG attendance.breaksEnabled is false. */
const breaksOn = (_req: Request, _res: Response, next: NextFunction) => next(service.breaksEnabled() ? undefined : notFound());

router.post('/breaks/start', authenticate, breaksOn, requireAction(A.breakStart), idempotent('attendance.break.start', { required: false }), h(async (req, res) => {
  const body = StartBreakSchema.parse(req.body ?? {});
  const breakRecord = await runCommand(req, (ctx) => service.startBreak(ctx, body));
  res.status(201).json({ break: breakRecord, label: DEMO_LABEL });
}));

router.post('/breaks/end', authenticate, breaksOn, requireAction(A.breakEnd), idempotent('attendance.break.end', { required: false }), h(async (req, res) => {
  const body = EndBreakSchema.parse(req.body ?? {});
  const breakRecord = await runCommand(req, (ctx) => service.endBreak(ctx, body));
  res.json({ break: breakRecord, label: DEMO_LABEL });
}));

router.get('/breaks/active', authenticate, breaksOn, requireAction(A.breakRead), h(async (req, res) => {
  const activeInfo = await service.getActiveBreak(pool, principalFromRequest(req));
  res.json(activeInfo);
}));

router.get('/sessions/:id/breaks', authenticate, breaksOn, requireAction(A.breakRead), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  const breaks = await service.listSessionBreaks(pool, principalFromRequest(req), id);
  res.json({ breaks });
}));

// ---------------------------------------------------------------- sessions

router.get('/sessions', authenticate, requireAction(A.read), h(async (req, res) => {
  const q = SessionsQuerySchema.parse(req.query);
  res.json(await service.listSessions(pool, principalFromRequest(req), q));
}));

router.post('/sessions', authenticate, requireAction(A.retroactive), idempotent('attendance.retroactive_create', { required: false }), h(async (req, res) => {
  const body = RetroactiveSchema.parse(req.body);
  res.status(201).json(await runCommand(req, (ctx) => service.createRetroactive(ctx, body)));
}));

router.get('/sessions/:id', authenticate, requireAction(A.read), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  res.json(await service.getSession(pool, principalFromRequest(req), id));
}));

router.post('/sessions/:id/adjust', authenticate, requireAction(A.adjust), idempotent('attendance.adjust', { required: false }), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  const body = AdjustSchema.parse(req.body);
  res.json(await runCommand(req, (ctx) => service.adjustSession(ctx, id, body)));
}));

router.post('/sessions/:id/resolve-review', authenticate, requireAction(A.failedCheckoutReview), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  const body = ResolveReviewSchema.parse(req.body);
  res.json(await runCommand(req, (ctx) => service.resolveReview(ctx, id, body)));
}));

// ---------------------------------------------------------------- corrections (DEC-011)

router.post('/corrections', authenticate, requireAction(A.correctionRequest), idempotent('attendance.correction.request', { required: false }), h(async (req, res) => {
  const body = CorrectionRequestSchema.parse(req.body);
  res.status(201).json(await runCommand(req, (ctx) => service.requestCorrection(ctx, body)));
}));

router.get('/corrections', authenticate, requireAction(A.read), h(async (req, res) => {
  const q = CorrectionsQuerySchema.parse(req.query);
  res.json(await service.listCorrections(pool, principalFromRequest(req), q));
}));

router.get('/corrections/:id', authenticate, requireAction(A.read), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  res.json(await service.getCorrection(pool, principalFromRequest(req), id));
}));

router.post('/corrections/:id/approve', authenticate, requireAction(A.correctionReview), idempotent('attendance.correction.approve', { required: false }), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  const body = VersionReasonSchema.parse(req.body);
  res.json(await runCommand(req, (ctx) => service.approveCorrection(ctx, id, body)));
}));

router.post('/corrections/:id/reject', authenticate, requireAction(A.correctionReview), idempotent('attendance.correction.reject', { required: false }), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  const body = RejectCorrectionSchema.parse(req.body);
  res.json(await runCommand(req, (ctx) => service.rejectCorrection(ctx, id, body)));
}));

router.post('/corrections/:id/withdraw', authenticate, requireAction(A.correctionRequest), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  const body = WithdrawSchema.parse(req.body);
  res.json(await runCommand(req, (ctx) => service.withdrawCorrection(ctx, id, body)));
}));

// ---------------------------------------------------------------- Owner monitoring (OWN-004)

router.get('/overview', authenticate, requireAction(A.overview), h(async (req, res) => {
  const q = OverviewQuerySchema.parse(req.query);
  res.json(await service.overview(pool, q));
}));

// ---------------------------------------------------------------- settings (WF-ADMIN-001)

// Owner + 2FA holds `settings.read` (full view); every other role reads the derived values through
// `attendance.read` (R3: the split is an access declaration, chosen by the engine's `can`).
router.get(
  '/settings',
  authenticate,
  requireActionFor((req) => (req.user?.role === 'owner' ? A.settingsRead : A.read), [A.settingsRead, A.read]),
  h(async (req, res) => {
    res.json(await service.getSettingsView(pool, can(principalFromRequest(req), A.settingsRead)));
  })
);

router.put('/settings', authenticate, requireAction(A.settingsUpdate), h(async (req, res) => {
  const body = PutSettingsSchema.parse(req.body);
  res.json(await runCommand(req, (ctx) => service.putSettings(ctx, body)));
}));

router.post('/settings/test-office-check', authenticate, requireAction(A.settingsUpdate), h(async (req, res) => {
  const body = TestOfficeCheckSchema.parse(req.body ?? {});
  res.json(await service.testOfficeCheck(pool, req.ip ?? null, body.officeIps));
}));

// ---------------------------------------------------------------- per-employee schedule (Owner decision 2026-10-29)

router.get('/employees/:id/schedule', authenticate, requireAction(A.settingsRead), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  res.json(await service.getEmployeeSchedule(pool, id));
}));

router.put('/employees/:id/schedule', authenticate, requireAction(A.settingsUpdate), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  const body = PutEmployeeScheduleSchema.parse(req.body);
  res.json(await runCommand(req, (ctx) => service.setEmployeeSchedule(ctx, id, body)));
}));

// ---------------------------------------------------------------- approved days off (D1)

router.get('/days-off', authenticate, requireAction(A.daysOff), h(async (req, res) => {
  const q = DaysOffQuerySchema.parse(req.query);
  res.json(await service.listDaysOff(pool, q));
}));

router.post('/days-off', authenticate, requireAction(A.daysOff), idempotent('attendance.days_off.create', { required: false }), h(async (req, res) => {
  const body = CreateDayOffSchema.parse(req.body);
  res.status(201).json(await runCommand(req, (ctx) => service.createDayOff(ctx, body)));
}));

router.post('/days-off/:id/cancel', authenticate, requireAction(A.daysOff), h(async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  const body = CancelDayOffSchema.parse(req.body);
  res.json(await runCommand(req, (ctx) => service.cancelDayOff(ctx, id, body)));
}));

// ---------------------------------------------------------------- remote exceptions (DEC-010)

router.get('/remote-exceptions', authenticate, requireAction(A.read), h(async (req, res) => {
  const q = RemoteQuerySchema.parse(req.query);
  res.json(await service.listRemote(pool, principalFromRequest(req), q));
}));

router.post('/remote-exceptions', authenticate, requireAction(A.remoteGrant), h(async (req, res) => {
  const body = GrantRemoteSchema.parse(req.body);
  res.status(201).json(await runCommand(req, (ctx) => service.grantRemote(ctx, body)));
}));

router.post('/remote-exceptions/requests', authenticate, requireAction(A.remoteRequest), h(async (req, res) => {
  const body = RequestRemoteSchema.parse(req.body);
  res.status(201).json(await runCommand(req, (ctx) => service.requestRemote(ctx, body)));
}));

for (const verb of ['approve', 'reject', 'revoke'] as const) {
  router.post(`/remote-exceptions/:id/${verb}`, authenticate, requireAction(A.remoteGrant), h(async (req, res) => {
    const { id } = IdParamSchema.parse(req.params);
    const body = RemoteDecisionSchema.parse(req.body);
    res.json(await runCommand(req, (ctx) => service.decideRemote(ctx, id, verb, body)));
  }));
}

export default router;
