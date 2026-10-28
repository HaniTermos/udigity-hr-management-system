/**
 * projects + tasks API (backend MOD-projects, BE4-C1). Owner: FE5. Screens: SCR-DEV-005..007.
 * Source of truth: backend `modules/projects/schemas.ts`.
 *  - A project status change is `POST /api/projects/:id/status`, never a PATCH (PATCH is name and schedule only).
 *  - Waiting for client and Blocked need a `note`. Delivered / Completed with open tasks answer
 *    `422 RULE_VIOLATION` with `details.code === 'OPEN_TASKS_WARNING'`; resend with `acknowledgeOpenTasks`.
 *  - A task cancel carries `cancelReason`. "Client dependency" is a chip on a task, never a status.
 *  - Responses are wrapped: `{ project }`, `{ task }`.
 */
import { api, ApiError, buildQuery, type QueryValue } from './client';
import type { AccessLevel, Id, IsoDate, IsoDateTime } from './types';

export const projectsPaths = {
  list: '/api/projects',
  detail: (id: string) => `/api/projects/${id}`,
  status: (id: string) => `/api/projects/${id}/status`,
  reopen: (id: string) => `/api/projects/${id}/reopen`,
  developers: (id: string) => `/api/projects/${id}/developers`,
  /** `:id` is the DEAL id (the project does not exist yet). */
  provisionRetry: (dealId: string) => `/api/projects/${dealId}/provision-retry`,
  tasks: '/api/tasks',
  task: (id: string) => `/api/tasks/${id}`,
} as const;

/** DEC-019 (Proposed): project statuses. Separate from task statuses. */
export type ProjectStatus =
  | 'scheduled'
  | 'in_progress'
  | 'waiting_for_client'
  | 'blocked'
  | 'delivered'
  | 'completed';

/** Proposed task statuses (no DEC ID). "Waiting for client" is a project status only. */
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
  id: Id;
  projectId: Id;
  version: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  ownerId: Id | null;
  ownerName: string | null;
  dueDate: IsoDate | null;
  isMilestone: boolean;
  /** Shown as the "Client dependency" chip next to the normal status. */
  clientDependency: boolean;
  clientDependencyNote: string | null;
  sortOrder: number;
  completedAt: IsoDateTime | null;
  cancelReason: string | null;
  allowedNextStatuses: TaskStatus[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TaskCounts {
  total: number;
  open: number;
  done: number;
  cancelled: number;
}

export interface Project {
  id: Id;
  code: string;
  version: number;
  dealId: Id;
  dealCode: string | null;
  businessId: Id;
  businessName: string | null;
  name: string;
  status: ProjectStatus;
  statusNote: string | null;
  startDate: IsoDate | null;
  targetDate: IsoDate | null;
  deliveredAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  provisionedBy: 'auto' | 'manual';
  developers: { id: Id; fullName: string }[];
  assignedToMe: boolean;
  /** Derived: target date passed and not delivered. */
  deliveryOverdue: boolean;
  /** Completed projects are read-only. */
  readOnly: boolean;
  taskCounts: TaskCounts;
  allowedNextStatuses: ProjectStatus[];
  allowed: { changeStatus: boolean; editSchedule: boolean; assignDevelopers: boolean; reopen: boolean; createTask: boolean };
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ProjectHistoryItem {
  id: Id;
  type: 'provisioned' | 'status_changed' | 'schedule_changed' | 'developer_assigned' | 'developer_unassigned';
  before: unknown;
  after: unknown;
  note: string | null;
  openTaskCount: number | null;
  actorId: Id | null;
  at: IsoDateTime;
}

export interface ProjectDetail extends Project {
  tasks: Task[];
  history: ProjectHistoryItem[];
}

export interface ProjectDetailResponse {
  project: ProjectDetail;
  access: AccessLevel;
}

export interface ProjectWorkload {
  activeProjects: number;
  deliveryOverdue: number;
  openTasks: number;
  completedThisMonth: number;
}

/** "Closed deal without project" (derived). */
export interface UnprovisionedDeal {
  dealId: Id;
  dealCode: string;
  businessId: Id;
  businessName: string | null;
  closedAt: IsoDateTime | null;
  provisioning: 'pending' | 'failed';
  attempts: number;
  lastErrorCode: string | null;
  nextAttemptAt: IsoDateTime | null;
}

export interface ProjectList {
  items: Project[];
  page: number;
  pageSize: number;
  total: number;
  workload: ProjectWorkload;
  unprovisioned: UnprovisionedDeal[];
  policy: { autoProvision: boolean; label: string };
}

export interface ProjectListQuery {
  status?: ProjectStatus;
  scope?: 'assigned_to_me' | 'all';
  developerId?: string;
  overdueOnly?: boolean;
  dealId?: string;
  page?: number;
  pageSize?: number;
  sort?: 'createdAt' | 'updatedAt' | 'targetDate' | 'code' | 'name' | 'status';
  order?: 'asc' | 'desc';
}

export function projectListPath(q: ProjectListQuery = {}): string {
  return `${projectsPaths.list}${buildQuery({ ...q, overdueOnly: q.overdueOnly || undefined } as Record<string, QueryValue>)}`;
}

export interface ProjectStatusChange {
  version: number;
  to: ProjectStatus;
  /** Required for Blocked (reason) and Waiting for client (note). */
  note?: string;
  acknowledgeOpenTasks?: boolean;
}

/** `details` of the 422 RULE_VIOLATION behind "Record delivered with open tasks?". */
export interface OpenTasksWarning {
  code: 'OPEN_TASKS_WARNING';
  from: ProjectStatus;
  to: ProjectStatus;
  openTaskCount: number;
  openTasks: { id: Id; title: string; status: TaskStatus; clientDependency: boolean }[];
}

/** The warning payload of a 422 `OPEN_TASKS_WARNING`, or null for any other error. */
export function asOpenTasksWarning(error: unknown): OpenTasksWarning | null {
  if (!(error instanceof ApiError) || error.status !== 422 || error.code !== 'RULE_VIOLATION') return null;
  const d = error.details as Partial<OpenTasksWarning> | undefined;
  return d && d.code === 'OPEN_TASKS_WARNING' && Array.isArray(d.openTasks) ? (d as OpenTasksWarning) : null;
}

export async function changeProjectStatus(id: string, body: ProjectStatusChange): Promise<Project> {
  return (await api.post<{ project: Project }>(projectsPaths.status(id), body)).project;
}

/** Owner only: Completed -> In progress. */
export async function reopenProject(id: string, body: { version: number; reason: string }): Promise<Project> {
  return (await api.post<{ project: Project }>(projectsPaths.reopen(id), body)).project;
}

/** Manual F2 only (auto mode answers 409 STATE_CONFLICT; an existing project answers 409 CONFLICT_DUPLICATE). */
export async function createProject(body: { dealId: string; name?: string; startDate?: string; targetDate?: string }, idempotencyKey?: string): Promise<Project> {
  return (await api.post<{ project: Project }>(projectsPaths.list, body, { idempotencyKey })).project;
}

export interface ProvisionRetryResult {
  project: Project | null;
  provisioning: { state: 'provisioned' | 'failed'; attempts: number; lastErrorCode: string | null };
}

/** Owner retry for F3. `dealId` is the DEAL id. */
export async function retryProvisioning(dealId: string): Promise<ProvisionRetryResult> {
  return api.post<ProvisionRetryResult>(projectsPaths.provisionRetry(dealId), {});
}

export interface TaskPatch {
  version: number;
  status?: TaskStatus;
  /** Required when `status` is `cancelled`. */
  cancelReason?: string;
  title?: string;
  description?: string | null;
  ownerId?: string | null;
  dueDate?: string | null;
  clientDependency?: boolean;
  clientDependencyNote?: string | null;
}

export async function updateTask(id: string, body: TaskPatch, idempotencyKey?: string): Promise<Task> {
  return (await api.patch<{ task: Task }>(projectsPaths.task(id), body, { idempotencyKey })).task;
}

export interface NewTask {
  projectId: string;
  title: string;
  description?: string;
  ownerId?: string;
  dueDate?: string;
  isMilestone?: boolean;
  clientDependency?: boolean;
  clientDependencyNote?: string;
}

export async function createTask(body: NewTask, idempotencyKey?: string): Promise<Task> {
  return (await api.post<{ task: Task }>(projectsPaths.tasks, body, { idempotencyKey })).task;
}
