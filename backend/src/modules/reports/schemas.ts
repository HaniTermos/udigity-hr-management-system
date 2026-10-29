/**
 * MOD-reports — Zod request schemas (.strict()) and VT-3 action declarations. Owner: BE5.
 * Contract: docs/implementation/plan.md §4.1, docs/security/authz-matrix.md §3.10.
 */
import { z } from 'zod';
import { defineMatrixActions } from '../access/matrix.js';

export const REPORT_ACTIONS = defineMatrixActions([
  'dashboard.owner.read',
  'report.read',
  'report.export',
] as const);

export const DashboardQuerySchema = z
  .object({
    period: z.enum(['today', '7d', '30d', 'custom']).optional().default('7d'),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from date must be YYYY-MM-DD').optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to date must be YYYY-MM-DD').optional(),
  })
  .strict();

export const ExportQuerySchema = z
  .object({
    /** A-18: the four report ids (and their legacy aliases) only. */
    report: z.enum(['rep-1', 'rep-2', 'rep-3', 'rep-4', 'timesheet', 'calling', 'deals', 'businesses']),
    format: z.enum(['csv', 'json']).optional().default('csv'),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from date must be YYYY-MM-DD').optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to date must be YYYY-MM-DD').optional(),
    /** R2-02 / EX-2 step-up: a current TOTP code, needed when this session has no step-up in the last 10 min. */
    totpCode: z.string().trim().regex(/^\d{6}$/).optional(),
  })
  .strict();

export interface DashboardMetricsDto {
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
  };
  attendance: {
    checkedInToday: number;
    checkedOutToday: number;
    absentOrMissingCheckin: number;
    missingCheckouts: number;
  };
  workload: {
    developerWorkload: Array<{
      developerId: string;
      developerName: string;
      activeDealsCount: number;
      activeProjectsCount: number;
      openTasksCount: number;
    }>;
  };
  deliveryMonitor: {
    failedDeliveriesCount: number;
    suppressedDeliveriesCount: number;
    failedRemindersCount: number;
  };
  /** D7: Owner-set targets active today (company timezone) with server-computed progress; [] = none set. */
  targets: {
    /** false = attendance schedule not configured: working-day rules are not applied yet. */
    scheduleConfigured: boolean;
    items: Array<{
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
    }>;
  };
}

export interface ReportItemDto {
  id: string;
  title: string;
  description: string;
  format: string;
  badge: string;
}
