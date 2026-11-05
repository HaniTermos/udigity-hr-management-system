/**
 * MOD-admin — HTTP routes. Owner: BE1.
 * Pattern: authenticate -> requireAction -> Zod parse -> service (runCommand) -> JSON.
 * Settings and audit are non-business resources (plan §5): role rules only, Owner + completed 2FA.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAction } from '../../shared/access.js';
import { toPage } from '../../shared/pagination.js';
import { runCommand } from '../../shared/tx.js';
import { pool } from '../../db/pool.js';
import { A, AuditQuerySchema, PatchSettingsSchema } from './schemas.js';
import { getFlagsView, getPublicSettingsView, getSettingsView, listAudit, updateSettings } from './service.js';

/** Mounted at /api/audit-events. Read-only: no update/delete routes exist (authz §3.10). */
export const auditRouter = Router();

auditRouter.get('/', authenticate, requireAction(A.auditRead), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = AuditQuerySchema.parse(req.query);
    // Viewing the audit log is not itself audited (OQ-18 demonstration default).
    const { items, total } = await listAudit(pool, q);
    res.json(toPage(items, total, q));
  } catch (e) {
    next(e);
  }
});

/** Mounted at /api/settings. */
export const settingsRouter = Router();

// Full view: Owner + completed 2FA (matrix `settings.read`). Everyone else uses /public (R3: the
// role split is an access declaration, not a handler branch).
settingsRouter.get('/', authenticate, requireAction(A.settingsRead), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getSettingsView(pool));
  } catch (e) {
    next(e);
  }
});

/** Derived values for every role (authz §3.9 note): company timezone + configured flag only. */
settingsRouter.get('/public', authenticate, requireAction(A.settingsReadPublic), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getPublicSettingsView(pool));
  } catch (e) {
    next(e);
  }
});

settingsRouter.get('/flags', authenticate, requireAction(A.settingsRead), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getFlagsView(pool));
  } catch (e) {
    next(e);
  }
});

settingsRouter.patch('/', authenticate, requireAction(A.settingsUpdate), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = PatchSettingsSchema.parse(req.body);
    res.json(await runCommand(req, (ctx) => updateSettings(ctx, body)));
  } catch (e) {
    next(e);
  }
});
