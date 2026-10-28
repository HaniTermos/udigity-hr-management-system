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
if (config.trustProxy) app.set('trust proxy', 1);
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

app.get('/readyz', async (_req, res) => {
  try {
    await query('SELECT 1');
    if (config.isProduction) {
      // Same resolver as every module (Owner-saved value, else POLICY_COMPANY_TIMEZONE, else the alias).
      const problem = companyTimezoneProblem(await getSetting(pool, 'company.timezone'));
      if (problem) {
        res.status(503).json({
          status: 'unready',
          error: `Essential configuration missing: ${problem}`,
        });
        return;
      }
      // UDI-6: a role change after start-up (grants widened, wrong DATABASE_URL) also fails readiness.
      if ((await runtimeRoleProblems(pool)).length > 0) {
        res.status(503).json({ status: 'unready', error: 'Unsafe database role (see the server log)' });
        return;
      }
    }
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (error) {
    console.error('Readiness check failed:', (error as Error).message);
    res.status(503).json({ status: 'unready', database: 'disconnected' });
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
