/**
 * reports API — backend MOD-reports (BE5).
 * Screens: SCR-OWN-001 dashboard, SCR-OWN-009 reports & exports (synchronous download).
 */
import { api, ApiError } from './client';
import { parseRetryAfter } from './rateLimit';
import { getCsrfToken, CSRF_HEADER } from './http';

export const reportsPaths = {
  dashboard: '/api/dashboard',
  reports: '/api/reports',
  export: '/api/reports/export',
} as const;

export interface DeveloperWorkloadItem {
  developerId: string;
  developerName: string;
  activeDealsCount: number;
  activeProjectsCount: number;
  openTasksCount: number;
}

export interface DashboardTarget {
  id: string;
  employeeId: string;
  employeeName: string;
  metric: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  targetValue: number;
  currentValue: number | null;
  progressNote: 'schedule_not_configured' | 'non_working_day' | 'unsupported_metric' | null;
  startDate: string;
  endDate: string;
}

export interface DashboardMetrics {
  period: 'today' | '7d' | '30d' | 'custom';
  companyTime: string;
  businesses: {
    total: number;
    addedInPeriod: number;
    pending: number;
    onHold: number;
    callbackRequests: number;
    rejected: number;
    unassigned: number;
    needingCorrections: number;
  };
  commercial: {
    acceptedOpportunities: number;
    acceptedInPeriod: number;
    closedDeals: number;
    closedInPeriod: number;
    closedVsCompletedRatio: number;
    /** Current deal count per stage (stage ids). */
    byStage: Record<string, number>;
    /** Open deals with a payment waiting for Owner verification. */
    pendingVerification: number;
  };
  delivery: {
    deliveredCount: number;
    completedCount: number;
    activeProjects: number;
    openTasks: number;
  };
  calling: {
    callAttemptsInPeriod: number;
    businessesContactedInPeriod: number;
    /** Per company day of the period, zero-filled; empty for ranges over 92 days. */
    daily: Array<{ day: string; attempts: number; contacted: number }>;
  };
  attendance: {
    checkedInToday: number;
    checkedOutToday: number;
    absentOrMissingCheckin: number;
    missingCheckouts: number;
  };
  workload: {
    developerWorkload: DeveloperWorkloadItem[];
  };
  deliveryMonitor: {
    failedDeliveriesCount: number;
    suppressedDeliveriesCount: number;
    failedRemindersCount: number;
  };
  /** D7: Owner-set targets active today, progress computed by the server. Empty = no target set. */
  targets: {
    scheduleConfigured: boolean;
    items: DashboardTarget[];
  };
}

export interface ReportItem {
  id: string;
  title: string;
  description: string;
  format: string;
  badge: string;
}

export async function getDashboardMetrics(
  period: 'today' | '7d' | '30d' | 'custom' = '7d',
  from?: string,
  to?: string
): Promise<DashboardMetrics> {
  return api.get<DashboardMetrics>(reportsPaths.dashboard, {
    query: { period, from, to },
  });
}

export async function listReports(): Promise<{ items: ReportItem[]; total: number }> {
  return api.get<{ items: ReportItem[]; total: number }>(reportsPaths.reports);
}

export interface ExportResult {
  blob: Blob;
  filename: string | null;
  rowCount: number | null;
  /** `X-Export-Row-Cap`: the most rows one export can hold. */
  rowCap: number | null;
  truncated: boolean;
}

/**
 * POST /api/reports/export. When the session has no step-up in the last 10 minutes the server answers 403
 * `STEP_UP_REQUIRED`; the caller then asks for a 6-digit authenticator code and repeats the call with `totpCode`.
 * Throws `ApiError` for every non-2xx answer.
 */
export async function exportReport(params: {
  report: string;
  format?: 'csv' | 'json';
  from?: string;
  to?: string;
  totpCode?: string;
}): Promise<ExportResult> {
  const csrf = getCsrfToken();
  let res: Response;
  try {
    res = await fetch(reportsPaths.export, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { [CSRF_HEADER]: csrf } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        report: params.report,
        format: params.format === 'json' ? 'json' : 'csv',
        from: params.from || undefined,
        to: params.to || undefined,
        totpCode: params.totpCode || undefined,
      }),
    });
  } catch {
    throw new ApiError(0, { error: 'Could not reach the server. Check your connection and try again.', code: 'NETWORK_ERROR' });
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; code?: string; details?: unknown } | null;
    const wait = parseRetryAfter(res.headers.get('Retry-After'));
    throw new ApiError(res.status, body ? { ...body, ...(wait !== undefined ? { retryAfterSeconds: wait } : {}) } : res.status === 429 ? { code: 'RATE_LIMITED', retryAfterSeconds: wait } : null);
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const rows = Number(res.headers.get('X-Export-Row-Count'));
  return {
    blob: await res.blob(),
    filename: match ? match[1] : null,
    rowCount: Number.isFinite(rows) && res.headers.has('X-Export-Row-Count') ? rows : null,
    rowCap: Number.isFinite(Number(res.headers.get('X-Export-Row-Cap'))) && res.headers.has('X-Export-Row-Cap') ? Number(res.headers.get('X-Export-Row-Cap')) : null,
    truncated: ['true', '1', 'yes'].includes((res.headers.get('X-Export-Truncated') ?? '').toLowerCase()),
  };
}
