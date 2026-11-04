/**
 * MOD-reports — service. Owner: BE5.
 * Dashboard metrics (arch-a §5A) and synchronous streaming exports (ADR-010; policy baseline 2026-10-29
 * "Fixed v1 scope": bounded by row cap, statement timeout, concurrency and rate limits; no async jobs).
 */
import type { Request } from 'express';
import { type Queryable, withTransaction } from '../../db/pool.js';
import { runCommand, audit } from '../../shared/tx.js';
import { HttpError, isHttpError } from '../../shared/errors.js';
import { recordAuditEvent } from '../admin/audit.js';
import { isValidTimeZone } from '../identity/env.js';
import { hasRecentStepUp, verifyStepUpTotp } from '../identity/routes.js';
import { clock } from '../platform/clock.js';
import { getCompanyTimezone } from '../attendance/service.js';
import { addDays, workDateOf, zonedToUtc } from '../attendance/time.js';
import { progressContext } from '../work/progress.js';
import * as workRepo from '../work/repo.js';
import { withProgress } from '../work/service.js';
import * as repo from './repo.js';
import type { DashboardMetricsDto, ReportItemDto } from './schemas.js';

/** Company-timezone dashboard window. `until` is exclusive (undefined = open-ended, up to now). */
export function dashboardRange(
  period: 'today' | '7d' | '30d' | 'custom',
  now: Date,
  timezone: string,
  from?: string,
  to?: string
): { since: Date; until?: Date; todayStart: Date } {
  const tz = timezone || 'UTC';
  const today = workDateOf(now, timezone);
  const todayStart = zonedToUtc(today, '00:00', tz);
  const daysBack = (n: number) => zonedToUtc(addDays(today, -n), '00:00', tz);
  if (period === 'today') return { since: todayStart, todayStart };
  if (period === '30d') return { since: daysBack(29), todayStart };
  if (period === 'custom' && from) {
    return { since: zonedToUtc(from, '00:00', tz), until: to ? zonedToUtc(addDays(to, 1), '00:00', tz) : undefined, todayStart };
  }
  return { since: daysBack(6), todayStart };
}

/** Longest custom range charted per day; longer ranges keep their totals but get no daily series. */
export const DAILY_SERIES_MAX_DAYS = 92;

/**
 * One row per company-timezone day of the dashboard period (up to today), zero-filled for days without calls.
 */
async function dailyCalling(
  db: Queryable,
  range: { since: Date; until?: Date },
  now: Date,
  tz: string
): Promise<DashboardMetricsDto['calling']['daily']> {
  const end = range.until && range.until < now ? range.until : now;
  const first = workDateOf(range.since, tz);
  const last = workDateOf(new Date(end.getTime() - 1), tz);
  const days: string[] = [];
  for (let d = first; d <= last && days.length <= DAILY_SERIES_MAX_DAYS; d = addDays(d, 1)) days.push(d);
  if (days.length === 0 || days.length > DAILY_SERIES_MAX_DAYS) return [];
  const rows = new Map((await repo.queryDailyCalling(db, range.since, end, tz)).map((r) => [r.day, r]));
  return days.map((day) => ({ day, attempts: rows.get(day)?.attempts ?? 0, contacted: rows.get(day)?.contacted ?? 0 }));
}

/**
 * D7: Owner-set targets whose period contains company today, with server-computed progress. No target →
 * an empty list (the UI says "No target set"); nothing here is an invented quota.
 */
async function activeTargets(db: Queryable, now: Date): Promise<DashboardMetricsDto['targets']> {
  const pctx = await progressContext(db, now);
  const withValues = await withProgress(db, await workRepo.listActiveTargets(db, pctx.today), pctx);
  return {
    scheduleConfigured: pctx.scheduleConfigured,
    items: withValues.map((t) => ({
      id: t.id,
      employeeId: t.employeeId,
      employeeName: t.employeeName ?? '',
      metric: t.metric,
      period: t.period,
      targetValue: t.targetValue,
      currentValue: t.currentValue,
      progressNote: t.progressNote ?? null,
      startDate: t.startDate,
      endDate: t.endDate,
    })),
  };
}

export async function getDashboardMetrics(
  db: Queryable,
  period: 'today' | '7d' | '30d' | 'custom' = '7d',
  from?: string,
  to?: string
): Promise<DashboardMetricsDto> {
  const now = clock.now();
  // D7: company-timezone dates. "today" starts at company midnight; 7d/30d are the last 7/30 company days
  // including today; custom is [from 00:00, to + 1 day 00:00) in the company timezone.
  const tz = (await getCompanyTimezone(db)) ?? '';
  const range = dashboardRange(period, now, tz, from, to);

  const stats = await repo.queryDashboardStats(db, range.since, range.until, range.todayStart);
  const devWorkload = await repo.queryDeveloperWorkload(db);
  const daily = await dailyCalling(db, range, now, tz);
  const stages = await repo.queryDealsByStage(db);
  const targets = await activeTargets(db, now);

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
      byStage: stages.byStage,
      pendingVerification: stages.pendingVerification,
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
      daily,
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
      failedOpsAlertsCount: stats.failedOpsAlerts,
    },
    // D7: Owner-set targets only (the former 500/12/200 bars were invented quotas and are removed).
    targets,
  };
}

/**
 * Report catalogue. It lists only what the export really produces (columns and formats). Every export is
 * limited to the first `EXPORT_LIMITS.rowCap` rows; the catalogue response and the export response headers
 * (`X-Export-Truncated`, `X-Export-Row-Count`, `X-Export-Row-Cap`) say so, so the UI can tell the user.
 */
export function listReports(): ReportItemDto[] {
  return [
    {
      id: 'rep-1',
      title: 'Company Timesheet & Punctuality Export',
      description: 'Daily check-in and checkout facts, total duration, punctuality flags, and approved corrections.',
      format: 'CSV / JSON',
      badge: 'Payroll Ready',
    },
    {
      id: 'rep-2',
      title: 'Commercial Outreach & Calling Logs',
      description: 'One row per call attempt: business, outcome, agent and time.',
      format: 'CSV / JSON',
      badge: 'Operational',
    },
    {
      id: 'rep-3',
      title: 'Closed Commercial Deals & Invoicing Ledger',
      description: 'One row per deal: stage, agreement reference, signature and payment dates, contract amount, payment received and project status.',
      format: 'CSV / JSON',
      badge: 'Executive',
    },
    {
      id: 'rep-4',
      title: 'Master Business Directory Dump',
      description: 'Active (not archived) businesses with branch and category.',
      format: 'CSV / JSON',
      badge: 'Database',
    },
  ];
}

/** R2-01: a cell starting with one of these is a formula in Excel/Sheets/LibreOffice (CSV injection). */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  // C-04: a Date is written as its ISO text; JSON.stringify(date) would add literal quote characters.
  let str = val instanceof Date ? (Number.isNaN(val.getTime()) ? '' : val.toISOString()) : typeof val === 'object' ? JSON.stringify(val) : String(val);
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
 * R2-02 export limits. EX-2 step-up window is the authz-matrix value (≤ 10 min). Row cap: S-32 (Owner
 * 2026-11-04) 10,000 rows per synchronous streamed export; the catalogue (`rowCap`) and the export headers
 * (`X-Export-Row-Cap`, `X-Export-Truncated`) tell the user when it is reached. Statement timeout and the
 * concurrency limits (routes.ts) are unchanged.
 */
export const EXPORT_LIMITS = {
  stepUpMinutes: 10,
  rowCap: repo.EXPORT_ROW_CAP,
  statementTimeoutMs: 15_000,
} as const;

/** Rows fetched from the export cursor per round trip (and written to the response per chunk). */
export const EXPORT_CHUNK_ROWS = 200;

export interface ExportMeta {
  contentType: string;
  filename: string;
  rowCount: number;
  truncated: boolean;
}

/** Thrown by a sink when the client closed the connection mid-export (C-21): audited as aborted by client. */
export class ClientAbortedError extends Error {
  constructor() {
    super('Client closed the export connection');
    this.name = 'ClientAbortedError';
  }
}

/**
 * Where a streamed export goes (the HTTP response in routes.ts). `start` is called once, before the first
 * chunk, with the final row count / truncation flag; `write` resolves when the chunk may be followed by
 * the next one (back-pressure).
 */
export interface ExportSink {
  start(meta: ExportMeta): void;
  write(chunk: string): Promise<void>;
}

/**
 * Incremental CSV / JSON writer. Concatenating `chunk()` outputs and `end()` gives exactly
 * `formatAsCsv(rows)` / `JSON.stringify(rows, null, 2)` for the same rows (streaming output equality).
 */
export function createExportSerializer(format: 'csv' | 'json') {
  let count = 0;
  let headers: string[] | null = null;
  return {
    chunk(rows: Record<string, unknown>[]): string {
      let out = '';
      for (const r of rows) {
        if (format === 'json') {
          out += `${count === 0 ? '[\n' : ',\n'}  ${JSON.stringify(r, null, 2).replace(/\n/g, '\n  ')}`;
        } else {
          if (!headers) {
            headers = Object.keys(r);
            out += headers.map(escapeCsvField).join(',');
          }
          const h = headers;
          out += `\r\n${h.map((k) => escapeCsvField(r[k])).join(',')}`;
        }
        count++;
      }
      return out;
    },
    end(): string {
      if (format === 'json') return count === 0 ? '[]' : '\n]';
      return '';
    },
  };
}

/**
 * Captures the one SQL statement a report query would run, without running it, so the export can be
 * streamed through a server-side cursor with the report's own SQL (per-report column definitions stay in
 * repo.queryExportRows). `usable` is false when the report did more than return that statement's rows
 * (several queries, or rows post-processed in JS): the export then falls back to the buffered result.
 */
function captureQuery(): { db: Queryable; captured: () => { text: string; values: unknown[] } | null; isSentinel: (rows: unknown) => boolean } {
  const sentinel: Record<string, unknown>[] = [];
  const calls: { text: string; values: unknown[] }[] = [];
  const db = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values: values ?? [] });
      return { rows: sentinel, rowCount: 0, fields: [], command: 'SELECT', oid: 0 };
    },
  } as unknown as Queryable;
  return { db, captured: () => (calls.length === 1 ? calls[0] : null), isSentinel: (rows) => rows === sentinel };
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
  totpCode: string | undefined,
  sink: ExportSink
): Promise<ExportMeta> {
  await assertStepUp(req, reportType, totpCode);
  // C-21: what had been sent when the export stopped (the export transaction itself rolls back).
  let sentRows = 0;
  let sentBytes = 0;
  try {
    return await runCommand(req, async (ctx) => {
      if (ctx.actor.kind !== 'employee') {
        throw new Error('Export can only be requested by an employee');
      }
      // R2-02 time cap: no export statement (cursor open/count/fetch) may run longer than this.
      await ctx.tx.query(`SET LOCAL statement_timeout = ${Number(EXPORT_LIMITS.statementTimeoutMs)}`);
      // D7: the from/to range is company-timezone days. The report SQL compares timestamps with `::date`,
      // which PostgreSQL resolves in the session time zone, so the transaction uses the company zone.
      const tz = (await getCompanyTimezone(ctx.tx)) ?? '';
      if (tz && isValidTimeZone(tz)) await ctx.tx.query(`SELECT set_config('TimeZone', $1, true)`, [tz]);

      const cap = EXPORT_LIMITS.rowCap;
      const probe = captureQuery();
      const probed = await repo.queryExportRows(probe.db, reportType, filters, cap + 1);
      const statement = probe.isSentinel(probed) ? probe.captured() : null;

      // Synchronous streaming: a server-side cursor over the report's own statement, counted (bounded by
      // cap + 1) before the first byte so the row count / truncation headers are exact, then fetched and
      // written in chunks. Fallback (report not a single statement): the buffered, capped result.
      let rowCount: number;
      let truncated: boolean;
      let buffered: Record<string, unknown>[] | null = null;
      if (statement) {
        await ctx.tx.query(`DECLARE export_cursor SCROLL CURSOR FOR ${statement.text}`, statement.values);
        const moved = await ctx.tx.query(`MOVE FORWARD ${cap + 1} IN export_cursor`);
        truncated = (moved.rowCount ?? 0) > cap;
        rowCount = Math.min(moved.rowCount ?? 0, cap);
        await ctx.tx.query('MOVE ABSOLUTE 0 IN export_cursor');
      } else {
        const fetched = await repo.queryExportRows(ctx.tx, reportType, filters, cap + 1);
        truncated = fetched.length > cap;
        buffered = truncated ? fetched.slice(0, cap) : fetched;
        rowCount = buffered.length;
      }

      const exportId = await repo.insertExportRecord(ctx.tx, {
        requestedBy: ctx.actor.employeeId,
        reportType,
        format,
        rowCount,
        filters,
      });

      await audit(ctx, {
        eventName: 'report.exported',
        entityType: 'report',
        entityId: exportId,
        after: {
          reportType,
          format,
          rowCount,
          truncated,
        },
      });

      const timestamp = workDateOf(clock.now(), tz && isValidTimeZone(tz) ? tz : '');
      const fmt: 'csv' | 'json' = format === 'json' ? 'json' : 'csv';
      const meta: ExportMeta = {
        contentType: fmt === 'json' ? 'application/json' : 'text/csv; charset=utf-8',
        filename: `report_${reportType}_${timestamp}.${fmt}`,
        rowCount,
        truncated,
      };
      sink.start(meta);
      const out = createExportSerializer(fmt);
      if (buffered) {
        for (let i = 0; i < buffered.length; i += EXPORT_CHUNK_ROWS) {
          const text = out.chunk(buffered.slice(i, i + EXPORT_CHUNK_ROWS));
          await sink.write(text);
          sentRows += Math.min(EXPORT_CHUNK_ROWS, buffered.length - i);
          sentBytes += Buffer.byteLength(text);
        }
      } else {
        for (let sent = 0; sent < rowCount; ) {
          const n = Math.min(EXPORT_CHUNK_ROWS, rowCount - sent);
          const { rows } = await ctx.tx.query<Record<string, unknown>>(`FETCH FORWARD ${n} FROM export_cursor`);
          if (rows.length === 0) break;
          sent += rows.length;
          const text = out.chunk(rows);
          await sink.write(text);
          sentRows += rows.length;
          sentBytes += Buffer.byteLength(text);
        }
        await ctx.tx.query('CLOSE export_cursor');
      }
      await sink.write(out.end());
      return meta;
    });
  } catch (err) {
    const timedOut = (err as { code?: string }).code === '57014'; // query_canceled (statement_timeout)
    if (err instanceof ClientAbortedError) {
      await auditExportOutcome(req, 'report.export_failed', { reportType, format, reason: 'aborted_by_client', rowsSent: sentRows, bytesSent: sentBytes });
    } else if (!isHttpError(err) || timedOut) {
      await auditExportOutcome(req, 'report.export_failed', { reportType, format, reason: timedOut ? 'time_cap' : 'error', rowsSent: sentRows, bytesSent: sentBytes });
    }
    throw err;
  }
}
