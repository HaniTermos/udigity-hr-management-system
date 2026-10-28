/**
 * MOD-reports — service. Owner: BE5.
 * Dashboard metrics (arch-a §5A) and synchronous exports (ADR-010).
 */
import type { Request } from 'express';
import { type Queryable, withTransaction } from '../../db/pool.js';
import { runCommand, audit } from '../../shared/tx.js';
import { HttpError, isHttpError } from '../../shared/errors.js';
import { recordAuditEvent } from '../admin/audit.js';
import { hasRecentStepUp, verifyStepUpTotp } from '../identity/routes.js';
import { clock } from '../platform/clock.js';
import * as repo from './repo.js';
import type { DashboardMetricsDto, ReportItemDto } from './schemas.js';

export async function getDashboardMetrics(
  db: Queryable,
  period: 'today' | '7d' | '30d' | 'custom' = '7d',
  from?: string,
  to?: string
): Promise<DashboardMetricsDto> {
  const now = clock.now();
  let since = new Date(now.getTime() - 7 * 86400_000);
  let until: Date | undefined;

  if (period === 'today') {
    since = new Date(now);
    since.setUTCHours(0, 0, 0, 0);
  } else if (period === '30d') {
    since = new Date(now.getTime() - 30 * 86400_000);
  } else if (period === 'custom' && from) {
    since = new Date(from);
    since.setUTCHours(0, 0, 0, 0);
    if (to) {
      until = new Date(to);
      until.setUTCHours(23, 59, 59, 999);
    }
  }

  const [stats, devWorkload] = await Promise.all([
    repo.queryDashboardStats(db, since, until),
    repo.queryDeveloperWorkload(db),
  ]);

  const closedVsCompRatio =
    stats.completedProjects > 0
      ? Number((stats.closedDeals / stats.completedProjects).toFixed(2))
      : stats.closedDeals > 0
        ? 1
        : 0;

  return {
    period,
    companyTime: now.toISOString(),
    businesses: {
      total: stats.totalBusinesses,
      addedInPeriod: stats.addedInPeriod,
      pending: stats.callingStates['pending'] ?? 0,
      onHold: stats.callingStates['on_hold'] ?? 0,
      callbackRequests: stats.callingStates['needs_another_call'] ?? 0,
      rejected: stats.callingStates['rejected'] ?? 0,
      unassigned: stats.unassignedBusinesses,
      needingCorrections: stats.needingCorrections,
    },
    commercial: {
      acceptedOpportunities: stats.acceptedOpportunities,
      acceptedInPeriod: stats.acceptedInPeriod,
      closedDeals: stats.closedDeals,
      closedInPeriod: stats.closedInPeriod,
      closedVsCompletedRatio: closedVsCompRatio,
    },
    delivery: {
      deliveredCount: stats.deliveredProjects,
      completedCount: stats.completedProjects,
      activeProjects: stats.activeProjects,
      openTasks: stats.openTasks,
    },
    calling: {
      callAttemptsInPeriod: stats.callAttemptsInPeriod,
      businessesContactedInPeriod: stats.businessesContactedInPeriod,
    },
    attendance: {
      checkedInToday: stats.checkedInToday,
      checkedOutToday: stats.checkedOutToday,
      absentOrMissingCheckin: 0,
      missingCheckouts: stats.missingCheckouts,
    },
    workload: {
      developerWorkload: devWorkload,
    },
    deliveryMonitor: {
      failedDeliveriesCount: stats.failedDeliveries,
      suppressedDeliveriesCount: stats.suppressedDeliveries,
      failedRemindersCount: stats.failedReminders,
    },
    targets: {
      outreachProgress: {
        current: stats.callAttemptsInPeriod,
        target: 500,
        percentage: Math.min(100, Number(((stats.callAttemptsInPeriod / 500) * 100).toFixed(1))),
      },
      closedDealsProgress: {
        current: stats.closedDeals,
        target: 12,
        percentage: Math.min(100, Number(((stats.closedDeals / 12) * 100).toFixed(1))),
      },
      contactedBusinessesProgress: {
        current: stats.businessesContactedInPeriod,
        target: 200,
        percentage: Math.min(100, Number(((stats.businessesContactedInPeriod / 200) * 100).toFixed(1))),
      },
    },
  };
}

export function listReports(): ReportItemDto[] {
  return [
    {
      id: 'rep-1',
      title: 'Company Timesheet & Punctuality Export',
      description: 'Daily check-in and checkout facts, total duration, punctuality flags, and approved corrections.',
      format: 'CSV / Excel (Streamed)',
      badge: 'Payroll Ready',
    },
    {
      id: 'rep-2',
      title: 'Commercial Outreach & Calling Logs',
      description: 'Complete record of dials, call outcomes, reservation locks, and agent notes.',
      format: 'CSV / JSON',
      badge: 'Operational',
    },
    {
      id: 'rep-3',
      title: 'Closed Commercial Deals & Invoicing Ledger',
      description: 'Signed agreements, verified deposit facts, project provisioning status, and contract values.',
      format: 'CSV / PDF Summary',
      badge: 'Executive',
    },
    {
      id: 'rep-4',
      title: 'Master Business Directory Dump',
      description: 'Full database of cataloged establishments, normalized phones, and category taxonomy.',
      format: 'CSV Dataset',
      badge: 'Database',
    },
  ];
}

/** R2-01: a cell starting with one of these is a formula in Excel/Sheets/LibreOffice (CSV injection). */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  // R2-01: neutralise formulas with a leading apostrophe (OWASP CSV injection guidance).
  if (typeof val !== 'number' && typeof val !== 'bigint' && FORMULA_PREFIX.test(str)) str = `'${str}`;
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatAsCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCsvField).join(',');
  const lines = rows.map((r) => headers.map((h) => escapeCsvField(r[h])).join(','));
  return [headerLine, ...lines].join('\r\n');
}

/**
 * R2-02 export limits. EX-2 step-up window is the authz-matrix value (≤ 10 min); the caps are
 * Security defaults ("Demonstration alternative — not approved" until the Owner confirms values).
 */
export const EXPORT_LIMITS = {
  stepUpMinutes: 10,
  rowCap: 1000,
  statementTimeoutMs: 15_000,
} as const;

export interface ExportResult {
  content: string;
  contentType: string;
  filename: string;
  rowCount: number;
  truncated: boolean;
}

type ExportAuditEvent = 'report.export_denied' | 'report.export_failed';

/** Denied/failed exports are audited in their own transaction (the export transaction rolled back). */
async function auditExportOutcome(req: Request, eventName: ExportAuditEvent, payload: Record<string, unknown>): Promise<void> {
  const u = req.user!;
  await withTransaction((tx) =>
    recordAuditEvent(tx, {
      eventName,
      actorId: u.id,
      actorRole: u.role,
      entityType: 'report',
      entityId: null,
      sessionId: u.sessionId,
      requestId: req.requestId,
      clientIp: req.ip ?? null,
      payload,
      sourceWorkflow: 'EX-2',
    })
  ).catch((err) => console.error('[reports] could not audit export outcome', { eventName, message: (err as Error).message }));
}

const STEP_UP_ERRORS = {
  required: () => new HttpError(403, 'STEP_UP_REQUIRED', 'Enter a current verification code to export'),
  invalid: () => new HttpError(400, 'INVALID_2FA_TOKEN', 'Invalid verification code'),
  locked: () => new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Please wait and try again.'),
  not_configured: () => new HttpError(400, '2FA_NOT_CONFIGURED', 'Two-factor authentication is not available for this step'),
} as const;

/**
 * EX-2 step-up: a TOTP verified on this session within the last 10 minutes, or a current code in
 * the request (`totpCode`). The code is checked in its own transaction so failures count toward
 * the factor lockout even though the export is refused.
 */
async function assertStepUp(req: Request, reportType: string, totpCode: string | undefined): Promise<void> {
  const u = req.user!;
  const now = new Date();
  if (await hasRecentStepUp(u.sessionId, now, EXPORT_LIMITS.stepUpMinutes)) return;
  if (!totpCode) {
    await auditExportOutcome(req, 'report.export_denied', { reportType, reason: 'step_up_required' });
    throw STEP_UP_ERRORS.required();
  }
  const result = await withTransaction((tx) => verifyStepUpTotp(tx, u.id, u.sessionId, totpCode, now));
  if (result === 'ok') return;
  await auditExportOutcome(req, 'report.export_denied', { reportType, reason: `step_up_${result}` });
  throw STEP_UP_ERRORS[result]();
}

export async function exportReport(
  req: Request,
  reportType: string,
  format: string,
  filters: Record<string, unknown> = {},
  totpCode?: string
): Promise<ExportResult> {
  await assertStepUp(req, reportType, totpCode);
  try {
    return await runCommand(req, async (ctx) => {
      if (ctx.actor.kind !== 'employee') {
        throw new Error('Export can only be requested by an employee');
      }
      // R2-02 time cap: the export query may not run longer than this (rolls back on timeout).
      await ctx.tx.query(`SET LOCAL statement_timeout = ${Number(EXPORT_LIMITS.statementTimeoutMs)}`);
      const fetched = await repo.queryExportRows(ctx.tx, reportType, filters, EXPORT_LIMITS.rowCap + 1);
      const truncated = fetched.length > EXPORT_LIMITS.rowCap;
      const rows = truncated ? fetched.slice(0, EXPORT_LIMITS.rowCap) : fetched;
      const exportId = await repo.insertExportRecord(ctx.tx, {
        requestedBy: ctx.actor.employeeId,
        reportType,
        format,
        rowCount: rows.length,
        filters,
      });

      await audit(ctx, {
        eventName: 'report.exported',
        entityType: 'report',
        entityId: exportId,
        after: {
          reportType,
          format,
          rowCount: rows.length,
          truncated,
        },
      });

      let content = '';
      let contentType = 'text/plain';
      const timestamp = clock.now().toISOString().slice(0, 10);
      let filename = `report_${reportType}_${timestamp}.txt`;

      if (format === 'json') {
        content = JSON.stringify(rows, null, 2);
        contentType = 'application/json';
        filename = `report_${reportType}_${timestamp}.json`;
      } else {
        content = formatAsCsv(rows);
        contentType = 'text/csv; charset=utf-8';
        filename = `report_${reportType}_${timestamp}.csv`;
      }

      return { content, contentType, filename, rowCount: rows.length, truncated };
    });
  } catch (err) {
    const timedOut = (err as { code?: string }).code === '57014'; // query_canceled (statement_timeout)
    if (!isHttpError(err) || timedOut) {
      await auditExportOutcome(req, 'report.export_failed', { reportType, format, reason: timedOut ? 'time_cap' : 'error' });
    }
    throw err;
  }
}
