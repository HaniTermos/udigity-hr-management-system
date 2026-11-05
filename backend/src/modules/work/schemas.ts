/**
 * MOD-work — Zod request schemas (.strict()) and VT-3 action declarations. Owner: BE1.
 * Contract: docs/implementation/plan.md §4.1, docs/security/authz-matrix.md §3.9.
 */
import { z } from 'zod';
import { MAX_PAGE } from '../../shared/pagination.js';
import { boundedInt, isoDate, isoDateOrDateTime, MAX_TARGET_VALUE, safeString } from '../../shared/validation.js';
import { defineMatrixActions } from '../access/matrix.js';
import { TARGET_METRICS, type ProgressNote } from './progress.js';

export const WORK_ACTIONS = defineMatrixActions([
  'target.set',
  'target.read',
  // R2-03: work items have their own rows (were guarded by target.read/target.set).
  'work_item.read',
  'work_item.create',
  'work_item.update',
] as const);

/**
 * D7 (policy baseline 2026-10-29): progress is computed on the server, so there is no `currentValue`
 * input. `endDate` is derived from `startDate` + `period` (weekly = Monday + 6); when sent it must match.
 */
export const CreateTargetSchema = z
  .object({
    employeeId: safeString().uuid(),
    metric: z.enum(TARGET_METRICS),
    period: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
    // C-17: a whole number of activities, 1..MAX_TARGET_VALUE (no 0.5, no overflow values).
    targetValue: boundedInt(1, MAX_TARGET_VALUE),
    startDate: isoDate(),
    endDate: isoDate().optional(),
    territory: safeString().max(120).optional(),
  })
  .strict();

export type CreateTargetInput = z.infer<typeof CreateTargetSchema>;

export const UpdateTargetSchema = z
  .object({
    version: z.number().int().positive(),
    targetValue: boundedInt(1, MAX_TARGET_VALUE).optional(),
    /** The period defines the dates, so it cannot change; accepted only when equal to the current one. */
    period: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional(),
    territory: safeString().max(120).optional(),
  })
  .strict();

export type UpdateTargetInput = z.infer<typeof UpdateTargetSchema>;

export const CreateWorkItemSchema = z
  .object({
    assigneeId: safeString().uuid(),
    title: safeString().min(1).max(200),
    description: safeString().max(2000).optional(),
    dueDate: isoDateOrDateTime().optional(),
    sourceType: safeString().max(60).optional(),
    sourceId: safeString().max(64).optional(),
  })
  .strict();

export type CreateWorkItemInput = z.infer<typeof CreateWorkItemSchema>;

export const UpdateWorkItemSchema = z
  .object({
    version: z.number().int().positive(),
    title: safeString().min(1).max(200).optional(),
    description: safeString().max(2000).optional(),
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
    dueDate: isoDateOrDateTime().optional().nullable(),
  })
  .strict();

export type UpdateWorkItemInput = z.infer<typeof UpdateWorkItemSchema>;

/** GET /api/work-items. `limit` is an alias of `pageSize` (My Day asks for the first 5). */
export const WorkItemsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: safeString().max(40).optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
    /** `open` = open + in_progress (My Day). */
    state: z.enum(['open', 'all']).optional(),
  })
  .strict();

/** GET /api/targets. Non-Owners always get their own targets; `scope=self` is accepted for clarity. */
export const TargetsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    sort: safeString().max(40).optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
    employeeId: safeString().uuid().optional(),
    scope: z.enum(['self', 'all']).optional(),
  })
  .strict();

export interface TargetDto {
  id: string;
  employeeId: string;
  employeeName?: string;
  metric: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  targetValue: number;
  /** D7: computed on the server from the actor columns; null = metric has no counting rule. */
  currentValue: number | null;
  /** Qualifier for the value: schedule not configured, daily target on a non-working day, unsupported metric. */
  progressNote?: ProgressNote;
  startDate: string;
  endDate: string;
  territory: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemDto {
  id: string;
  assigneeId: string;
  assigneeName?: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  dueDate: string | null;
  sourceType: string | null;
  sourceId: string | null;
  version: number;
  createdAt: string;
  // --- FX-BE-C4: My Day work-list fields (additive, filled on GET /api/work-items) ---------------
  /** The business the item is about (sourceType = business), only when the caller may read it. */
  businessId?: string | null;
  /** Row label: the business name when readable, else the item title. Never blank. */
  businessName?: string;
  kind?: 'follow_up' | 'new_assignment' | 'retry' | 'next';
  /** One-line detail composed by the server (due date + description excerpt). */
  detail?: string;
  /** Row chip: Overdue, Due today, In progress, To do, Done, Cancelled. */
  statusLabel?: string;
  /** Due date (YYYY-MM-DD) or null. */
  dueAt?: string | null;
  updatedAt: string;
}
