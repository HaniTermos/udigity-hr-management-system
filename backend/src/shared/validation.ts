/**
 * Shared zod building blocks (review C-01). Every request schema uses these instead of bare
 * `z.string()` / regex dates / unbounded numbers, so bad input is a 400 VALIDATION_ERROR and never
 * reaches PostgreSQL (where it would be a 500 and an ops alert).
 */
import { z } from 'zod';

/** C0 controls except TAB / LF / CR, plus DEL. NUL (U+0000) is rejected by PostgreSQL text columns. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const hasControlChars = (s: string): boolean => CONTROL_CHARS.test(s);

/** A string without NUL / control characters. Chain `.trim()`, `.min()`, `.max()` as usual. */
export const safeString = () => z.string().refine((s) => !CONTROL_CHARS.test(s), { message: 'Contains characters that are not allowed' });

/** Sane calendar range for business dates (payments, due dates, targets). */
export const MIN_ISO_YEAR = 1900;
export const MAX_ISO_YEAR = 2200;

/** True for a real calendar date `YYYY-MM-DD` (2026-02-31, 0000-01-01 and out-of-range years are false). */
export function isRealIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  if (y < MIN_ISO_YEAR || y > MAX_ISO_YEAR) return false;
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === y && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Strict `YYYY-MM-DD` that round-trips through the calendar. */
export const isoDate = (label = 'Expected a real date as YYYY-MM-DD') =>
  z.string().refine(isRealIsoDate, { message: label });

/** ISO date-time with offset, in the sane year range. */
export const isoDateTime = () =>
  z
    .string()
    .datetime({ offset: true })
    .refine((s) => {
      const t = Date.parse(s);
      if (Number.isNaN(t)) return false;
      const y = new Date(t).getUTCFullYear();
      return y >= MIN_ISO_YEAR && y <= MAX_ISO_YEAR;
    }, { message: 'Date out of range' });

/** Finite number within [min, max]. */
export const boundedNumber = (min: number, max: number) => z.number().finite().min(min).max(max);
/** Integer within [min, max]. */
export const boundedInt = (min: number, max: number) => z.number().int().min(min).max(max);

/** Largest value of a daily/weekly/... activity target (C-17). */
export const MAX_TARGET_VALUE = 100_000;

/** Calendar-day arithmetic on `YYYY-MM-DD` strings (no timezone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A real `YYYY-MM-DD` date OR an ISO date-time with offset (both validated, in range). */
export const isoDateOrDateTime = () =>
  z.union([isoDate(), isoDateTime()], { error: 'Expected a real date (YYYY-MM-DD) or ISO date-time' });
