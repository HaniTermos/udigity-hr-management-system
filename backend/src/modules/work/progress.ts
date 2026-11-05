/**
 * MOD-work — target progress (policy baseline 2026-10-29 §D7). Owner: BE1.
 *
 * Progress is computed on the server from the actor columns; nobody types it in:
 * - data_entries          businesses with created_by = employee, created_at in the period, not archived
 *                         (edits never count: they do not change created_by/created_at).
 * - businesses_contacted  per company-timezone day, distinct business_id with >= 1 call attempt by
 *                         agent_id (attempted_at); summed over the period's scheduled working days.
 * - tasks_completed       tasks status 'done' with completed_by_id = employee and completed_at in the
 *                         period. Reopening clears completed_at (DB check tasks_done_has_completion), so
 *                         a reopened-and-completed task is one row and counts once, in the period of its
 *                         latest completion.
 * - outreach_calls        (secondary) call attempts by agent_id in the period.
 * - closed_deals          (secondary) deals closed_by_id = employee, closed_at in the period.
 * Periods are company-timezone dates; the instants are [start 00:00, end + 1 day 00:00).
 * Daily targets apply to scheduled working days only. When the attendance schedule is not configured
 * progress is still shown, marked `schedule_not_configured`, and every day is counted (never an assumed
 * Monday–Friday).
 */
import type { Queryable } from '../../db/pool.js';
import { currentSchedule, employeeOverrideOn } from '../attendance/service.js';
import { addDays, nonWorkingReason, weekdayOf, workDateOf, zonedToUtc } from '../attendance/time.js';
import { clock } from '../platform/clock.js';

export const TARGET_METRICS = ['data_entries', 'businesses_contacted', 'tasks_completed', 'outreach_calls', 'closed_deals'] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];
export const isTargetMetric = (m: string): m is TargetMetric => (TARGET_METRICS as readonly string[]).includes(m);

export type TargetPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

/** Why a progress value needs a qualifier in the UI. `null` = plain, computed value. */
export type ProgressNote = 'schedule_not_configured' | 'non_working_day' | 'unsupported_metric' | null;

export interface ProgressContext {
  /** IANA zone; '' = not configured (UTC dates are used then). */
  timezone: string;
  scheduleConfigured: boolean;
  workingDays: string[];
  holidays: string[];
  /** Company-timezone date of now (YYYY-MM-DD). */
  today: string;
}

/** Snapshot of the attendance schedule + company "today" for one request. */
export async function progressContext(db: Queryable, now: Date = clock.now()): Promise<ProgressContext> {
  const { schedule } = await currentSchedule(db);
  const timezone = schedule.timezone;
  return {
    timezone,
    // D1/D7: only an Owner-saved attendance schedule defines working days (never an assumed Mon–Fri).
    scheduleConfigured: schedule.saved === true && Boolean(timezone),
    workingDays: schedule.workingDays,
    holidays: schedule.holidays,
    today: workDateOf(now, timezone),
  };
}

/** Last day of a period that starts on `start` (pure calendar arithmetic; same rule as the UI's periodEnd). */
export function derivePeriodEnd(start: string, period: TargetPeriod): string {
  const [y, m, d] = start.split('-').map(Number);
  const utc = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd)).toISOString().slice(0, 10);
  if (period === 'daily') return start;
  if (period === 'weekly') return utc(y, m - 1, d + 6);
  if (period === 'monthly') return utc(y, m, 0);
  return utc(y, Math.floor((m - 1) / 3) * 3 + 3, 0);
}

/** D7: weekly targets run Monday–Sunday (company timezone). */
export const isMonday = (date: string): boolean => weekdayOf(date) === 'MON';

/** Instants bounding the company-timezone dates [start, end]. */
export function periodInstants(start: string, end: string, timezone: string): { from: Date; until: Date } {
  const tz = timezone || 'UTC';
  return { from: zonedToUtc(start, '00:00', tz), until: zonedToUtc(addDays(end, 1), '00:00', tz) };
}

/** Scheduled working days within [start, end] (every day when the schedule is not configured). */
export function workingDaysIn(start: string, end: string, ctx: Pick<ProgressContext, 'scheduleConfigured' | 'workingDays' | 'holidays'>): Set<string> {
  const out = new Set<string>();
  // Bounded: a quarter is at most 92 days; the guard only stops a malformed range from looping.
  for (let d = start, i = 0; d <= end && i < 400; d = addDays(d, 1), i++) {
    if (!ctx.scheduleConfigured || nonWorkingReason(d, ctx) === null) out.add(d);
  }
  return out;
}

export interface ProgressInput {
  employeeId: string;
  metric: string;
  period: TargetPeriod;
  startDate: string;
  endDate: string;
}

export interface Progress {
  /** null = the metric has no server-side counting rule (legacy free-text metric). */
  value: number | null;
  note: ProgressNote;
}

async function countOne(db: Queryable, sql: string, params: unknown[]): Promise<number> {
  const { rows } = await db.query<{ n: number }>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

export async function computeProgress(db: Queryable, base: ProgressContext, t: ProgressInput): Promise<Progress> {
  if (!isTargetMetric(t.metric)) return { value: null, note: 'unsupported_metric' };
  // Owner decision 2026-10-29: the employee's own working days (override effective at the period start).
  const own = base.scheduleConfigured ? await employeeOverrideOn(db, t.employeeId, t.startDate) : null;
  const ctx: ProgressContext = own?.workingDays ? { ...base, workingDays: own.workingDays } : base;
  const { from, until } = periodInstants(t.startDate, t.endDate, ctx.timezone);
  let note: ProgressNote = ctx.scheduleConfigured ? null : 'schedule_not_configured';
  if (ctx.scheduleConfigured && t.period === 'daily' && nonWorkingReason(t.startDate, ctx) !== null) note = 'non_working_day';

  let value: number;
  switch (t.metric) {
    case 'data_entries':
      value = await countOne(
        db,
        `SELECT count(*)::int AS n FROM businesses
          WHERE created_by = $1 AND created_at >= $2 AND created_at < $3 AND archived_at IS NULL`,
        [t.employeeId, from, until]
      );
      break;
    case 'businesses_contacted': {
      const { rows } = await db.query<{ d: string; n: number }>(
        `SELECT to_char(timezone($4::text, attempted_at), 'YYYY-MM-DD') AS d, count(DISTINCT business_id)::int AS n
           FROM call_attempts
          WHERE agent_id = $1 AND attempted_at >= $2 AND attempted_at < $3
          GROUP BY 1`,
        [t.employeeId, from, until, ctx.timezone || 'UTC']
      );
      const days = workingDaysIn(t.startDate, t.endDate, ctx);
      value = rows.filter((r) => days.has(r.d)).reduce((sum, r) => sum + Number(r.n), 0);
      break;
    }
    case 'tasks_completed':
      value = await countOne(
        db,
        `SELECT count(*)::int AS n FROM tasks
          WHERE status = 'done' AND completed_by_id = $1 AND completed_at >= $2 AND completed_at < $3`,
        [t.employeeId, from, until]
      );
      break;
    case 'outreach_calls':
      value = await countOne(
        db,
        'SELECT count(*)::int AS n FROM call_attempts WHERE agent_id = $1 AND attempted_at >= $2 AND attempted_at < $3',
        [t.employeeId, from, until]
      );
      break;
    case 'closed_deals':
      value = await countOne(
        db,
        `SELECT count(*)::int AS n FROM deals
          WHERE stage = 'closed' AND closed_by_id = $1 AND closed_at >= $2 AND closed_at < $3`,
        [t.employeeId, from, until]
      );
      break;
  }
  return { value, note };
}
