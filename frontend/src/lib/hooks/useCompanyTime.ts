'use client';

import { useCallback, useMemo } from 'react';
import { useApi } from './useApi';
import { useAuth } from '@/lib/auth';
import type { SettingsDto } from '@/lib/api/admin';
import { useToday } from '@/components/attendance/hooks';

export interface CompanyTime {
  /** IANA name from settings, or null while "Not configured" (DEC-007). */
  timezone: string | null;
  configured: boolean;
  /** Format an ISO instant in the company timezone (browser timezone until configured). */
  format: (iso: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (iso: string | Date) => string;
  formatDate: (iso: string | Date) => string;
  /** `YYYY-MM-DD` of the instant in the company timezone. */
  dayKey: (iso: string | Date) => string;
}

function isValidZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const toDate = (v: string | Date) => (typeof v === 'string' ? new Date(v) : v);

/**
 * Times render in the company timezone from settings (plan.md §9). When the setting is empty (policy
 * "Not configured") or the caller may not read settings, it falls back to the browser zone and reports
 * `configured: false`; callers should then show the "Not configured" notice.
 */
export function useCompanyTime(): CompanyTime {
  const { user, sessionState } = useAuth();
  // Everyone reads the timezone from their attendance day (`schedule.timezone`, BE1-C2); only the Owner may read the
  // full settings, so other roles never call it (it would be a 403).
  const { data: today } = useToday();
  const key = user && sessionState === 'active' && user.role === 'owner' ? '/api/settings' : null;
  const { data } = useApi<SettingsDto>(key, { revalidateOnFocus: false, dedupingInterval: 60_000 });

  const company = data?.company as Record<string, unknown> | undefined;
  const raw = today?.schedule?.timezone ?? company?.['company.timezone'] ?? company?.timezone;
  const timezone = isValidZone(raw) ? raw : null;

  const format = useCallback(
    (iso: string | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) =>
      new Intl.DateTimeFormat('en-GB', { ...options, ...(timezone ? { timeZone: timezone } : {}) }).format(toDate(iso)),
    [timezone]
  );

  return useMemo(
    () => ({
      timezone,
      configured: timezone !== null,
      format,
      formatTime: (iso) => format(iso, { hour: '2-digit', minute: '2-digit', hour12: false }),
      formatDate: (iso) => format(iso, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
      dayKey: (iso) =>
        new Intl.DateTimeFormat('en-CA', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          ...(timezone ? { timeZone: timezone } : {}),
        }).format(toDate(iso)),
    }),
    [timezone, format]
  );
}
