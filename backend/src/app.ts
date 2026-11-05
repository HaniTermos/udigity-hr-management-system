import { apiReadLimiter } from './shared/rateLimit.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { originCheck, requestId } from './middleware/requestGuards.js';
import { registerModules } from './modules/index.js';
import { pool, query } from './db/pool.js';
import { companyTimezoneProblem, getSetting } from './modules/admin/service.js';
import { runtimeRoleProblems } from './shared/runtimeRole.js';

export const app = express();

// Security and utility middleware
// D2: X-Forwarded-For is honoured only from the explicitly trusted proxies (TRUSTED_PROXY_CIDRS). Unset:
// development/test keep the legacy single hop (TRUST_PROXY=true); production trusts none (/readyz 503).
if (config.trustedProxyCidrs) app.set('trust proxy', config.trustedProxyCidrs);
else if (!config.isProduction && config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(requestId);
app.use(helmet());
// ADR-002 says same origin (CORS not needed). Kept, restricted to the configured app origin(s),
// for the local split dev setup.
app.use(
  cors({
    origin: config.appOrigins,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
// Origin/Referer check on every mutating request (ADR-002/003). The per-session CSRF token is
// checked in authenticate() for authenticated mutations.
app.use(originCheck);

// Health probes (ADR-015)
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// C-15: the contract is the STATUS CODE (200 ready / 503 unready; the compose healthcheck and
// prod-smoke.sh read only that). The body is generic so an anonymous caller learns nothing about the
// configuration; the reason goes to the server log. nginx also answers 404 for it at the edge.
const UNREADY = { status: 'unready' } as const;
let lastUnreadyReason: string | null = null;
function unready(res: express.Response, reason: string) {
  // Log on change only, so a polling healthcheck does not flood the log.
  if (reason !== lastUnreadyReason) console.error(`Readiness check failed: ${reason}`);
  lastUnreadyReason = reason;
  res.status(503).json(UNREADY);
}

app.get('/readyz', async (_req, res) => {
  try {
    await query('SELECT 1');
    if (config.isProduction) {
      // Same resolver as every module (Owner-saved value, else POLICY_COMPANY_TIMEZONE, else the alias).
      const problem = companyTimezoneProblem(await getSetting(pool, 'company.timezone'));
      if (problem) return unready(res, `essential configuration missing: ${problem}`);
      // D2: the office check needs the trusted reverse-proxy list (no implicit hop count in production).
      if (!config.trustedProxyCidrs) return unready(res, 'essential configuration missing: TRUSTED_PROXY_CIDRS');
      // UDI-6: a role change after start-up (grants widened, wrong DATABASE_URL) also fails readiness.
      if ((await runtimeRoleProblems(pool)).length > 0) return unready(res, 'unsafe database role (runtime role check)');
    }
    lastUnreadyReason = null;
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    unready(res, `database: ${(error as Error).message}`);
  }
});

// Domain module API routes: one registry (modules/index.ts). Paths are unchanged from Increment 1
// (/api/auth, /api/employees) plus the stub mounts listed in docs/implementation/plan.md §4.1.
// API responses are never cached by browsers or proxies (arch-b §7 leakage controls).
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
// R2-07 / A-06: one per-caller budget for every API read (EX-3 scraping); session probes exempt.
app.use('/api', apiReadLimiter);
registerModules(app);

// Unknown API paths get the shared JSON error shape instead of Express's HTML 404.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND', requestId: req.requestId });
});

// Global Error Handler
app.use(errorHandler);

export default app;
