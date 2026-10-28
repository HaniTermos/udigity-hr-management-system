/**
 * work API — backend MOD-work (BE1).
 * Screens: SCR-OWN-006 targets & work lists; FE1 reads `myWorkItems` on My Day.
 */
import { api } from './client';
import type { Page } from './types';

export const workPaths = {
  targets: '/api/targets',
  target: (id: string) => `/api/targets/${id}`,
  workItems: '/api/work-items',
  workItem: (id: string) => `/api/work-items/${id}`,
  myWorkItems: '/api/work-items',
} as const;

export interface TargetItem {
  id: string;
  employeeId: string;
  employeeName?: string;
  metric: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  targetValue: number;
  currentValue: number;
  startDate: string;
  endDate: string;
  territory: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItem {
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
  updatedAt: string;
}

export async function listTargets(options: {
  employeeId?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Page<TargetItem>> {
  return api.get<Page<TargetItem>>(workPaths.targets, {
    query: {
      employeeId: options.employeeId,
      page: options.page,
      pageSize: options.pageSize,
    },
  });
}

export async function createTarget(input: {
  employeeId: string;
  metric: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  targetValue: number;
  currentValue?: number;
  startDate: string;
  endDate: string;
  territory?: string;
}): Promise<TargetItem> {
  return api.post<TargetItem>(workPaths.targets, input);
}

export async function updateTarget(
  id: string,
  input: {
    version: number;
    targetValue?: number;
    currentValue?: number;
    period?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    territory?: string;
  }
): Promise<TargetItem> {
  return api.patch<TargetItem>(workPaths.target(id), input);
}

export async function listWorkItems(options: {
  status?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Page<WorkItem>> {
  return api.get<Page<WorkItem>>(workPaths.workItems, {
    query: {
      status: options.status,
      page: options.page,
      pageSize: options.pageSize,
    },
  });
}

export async function createWorkItem(input: {
  assigneeId: string;
  title: string;
  description?: string;
  dueDate?: string;
  sourceType?: string;
  sourceId?: string;
}): Promise<WorkItem> {
  return api.post<WorkItem>(workPaths.workItems, input);
}

export async function updateWorkItem(
  id: string,
  input: {
    version: number;
    title?: string;
    description?: string;
    status?: 'open' | 'in_progress' | 'completed' | 'cancelled';
    dueDate?: string | null;
  }
): Promise<WorkItem> {
  return api.patch<WorkItem>(workPaths.workItem(id), input);
}
