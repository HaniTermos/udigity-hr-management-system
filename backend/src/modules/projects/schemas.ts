/**
 * MOD-projects - Zod request schemas (.strict()), DTO types, transition tables and VT-3 action
 * declarations for projects and tasks. Owner: BE4. Status: Increment 5 (live).
 * Design: docs/implementation/delivery-design.md §4, §5, §7.
 *
 * Pending policies (each "Demonstration alternative - not approved (docs/policy-defaults.md)"):
 * DEC-019 project statuses, OQ-06/07/08 developers, OQ-09 milestone attribute, OQ-10 open tasks warn
 * only, OQ-11 no Cancelled project status, OQ-15 Owner reopen of Completed, F2 `projects.autoProvision`.
 */
import { z } from 'zod';
import { PageQuerySchema } from '../../shared/pagination.js';
import { defineMatrixActions } from '../access/schemas.js';
import { BoolQuery } from '../deals/schemas.js';

// ---------------------------------------------------------------------------
// VT-3 actions (docs/security/authz-matrix.md §3.8). Resource rules (assigned Developer, Owner only)
// are access.check + service guards. Reading tasks uses `project.board.read` (no task.read row).
// POST /api/projects (manual F2 provisioning) has no matrix row: gated by `deal.update_stage`
// (Owner, Developer) and narrowed in the service to Owner or the deal's assigned Developer ([BE4-R2]).
// ---------------------------------------------------------------------------
export const PROJECT_ACTIONS = defineMatrixActions([
  'project.read',
  'project.board.read',
  'project.update_status',
  'project.assign_developers',
  'project.reopen_completed',
  'project.provision_retry',
  'task.create',
  'task.update',
  'task.complete',
] as const);

export const IdParam = z.object({ id: z.string().uuid() }).strict();
const Version = z.number().int().min(1);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const Note = z.string().trim().min(3).max(1000);

// ---------------------------------------------------------------------------
// Statuses and transition tables (single source for guards and `allowedNextStatuses`)
// ---------------------------------------------------------------------------
export const PROJECT_STATUSES = ['scheduled', 'in_progress', 'waiting_for_client', 'blocked', 'delivered', 'completed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** SM-PROJECT-001 (DEC-019, demonstration). Completed is read-only; Owner reopen is a separate command. */
export const PROJECT_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = Object.freeze({
  scheduled: ['in_progress', 'waiting_for_client', 'blocked'],
  in_progress: ['scheduled', 'waiting_for_client', 'blocked', 'delivered'],
  waiting_for_client: ['in_progress', 'scheduled', 'blocked'],
  blocked: ['in_progress', 'scheduled', 'waiting_for_client'],
  delivered: ['in_progress', 'completed'],
  completed: [],
});

/** Statuses that need a note (stored in `projects.status_note`, DB check). */
export const NOTE_REQUIRED_STATUSES: readonly ProjectStatus[] = ['waiting_for_client', 'blocked'];

/** Moves that run the P7 open-task warning (OQ-10: a warning, never a block). */
export const OPEN_TASK_WARNING_TARGETS: readonly ProjectStatus[] = ['delivered', 'completed'];

export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const OPEN_TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress'];

/** SM-TASK-001. `done -> in_progress` is Reopen; `cancelled` needs `cancelReason` and is final. */
export const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = Object.freeze({
  todo: ['in_progress', 'done', 'cancelled'],
  in_progress: ['todo', 'done', 'cancelled'],
  done: ['in_progress'],
  cancelled: [],
});

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------
/** GET /api/projects (SCR-DEV-005 list + Development workload). */
export const ListProjectsQuery = PageQuerySchema.extend({
  status: z.enum(PROJECT_STATUSES).optional(),
  developerId: z.string().uuid().optional(),
  scope: z.enum(['assigned_to_me', 'all']).optional(),
  overdueOnly: BoolQuery.optional(),
  dealId: z.string().uuid().optional(),
}).strict();

/** POST /api/projects - manual provisioning, only while `projects.autoProvision` is false (F2). */
export const CreateProjectBody = z.object({
  dealId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  startDate: IsoDate.optional(),
  targetDate: IsoDate.optional(),
}).strict();

/** PATCH /api/projects/:id - name and schedule only. Status moves are the `status` command. */
export const UpdateProjectBody = z.object({
  version: Version,
  name: z.string().trim().min(1).max(200).optional(),
  startDate: IsoDate.nullable().optional(),
  targetDate: IsoDate.nullable().optional(),
}).strict();

/** POST /api/projects/:id/status - `note` required for waiting_for_client / blocked. */
export const ProjectStatusBody = z.object({
  version: Version,
  to: z.enum(PROJECT_STATUSES),
  note: Note.optional(),
  /** P7: true after the user confirmed "Record delivered/completed with open tasks?". */
  acknowledgeOpenTasks: z.boolean().optional(),
}).strict().refine((b) => !NOTE_REQUIRED_STATUSES.includes(b.to) || b.note !== undefined, {
  message: 'A note is required for this status',
  path: ['note'],
});

/** POST /api/projects/:id/reopen - Owner, Completed -> In progress, reason required (OQ-15). */
export const ReopenProjectBody = z.object({ version: Version, reason: Note }).strict();

/** POST /api/projects/:id/developers - Owner sets the current Developer set (OQ-07/OQ-08). */
export const AssignProjectDevelopersBody = z.object({
  version: Version,
  developerIds: z.array(z.string().uuid()).max(20),
}).strict();

/** POST /api/projects/:id/provision-retry - `:id` is the DEAL id (the project does not exist yet). */
export const ProvisionRetryBody = z.object({}).strict();

/** GET /api/tasks?projectId= */
export const ListTasksQuery = z.object({
  projectId: z.string().uuid(),
  status: z.enum(TASK_STATUSES).optional(),
}).strict();

const TaskFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000),
  ownerId: z.string().uuid(),
  dueDate: IsoDate,
  startDate: IsoDate,
  isMilestone: z.boolean(),
  clientDependency: z.boolean(),
  clientDependencyNote: z.string().trim().max(500),
};

/** POST /api/tasks */
export const CreateTaskBody = z.object({
  projectId: z.string().uuid(),
  title: TaskFields.title,
  description: TaskFields.description.optional(),
  ownerId: TaskFields.ownerId.optional(),
  dueDate: TaskFields.dueDate.optional(),
  startDate: TaskFields.startDate.optional(),
  isMilestone: TaskFields.isMilestone.optional(),
  clientDependency: TaskFields.clientDependency.optional(),
  clientDependencyNote: TaskFields.clientDependencyNote.optional(),
}).strict().refine((b) => !b.startDate || !b.dueDate || b.startDate <= b.dueDate, {
  message: 'The start date must be on or before the due date',
  path: ['startDate'],
});

/** PATCH /api/tasks/:id - fields and/or a status move (board drag). `cancelled` needs `cancelReason`. */
export const UpdateTaskBody = z.object({
  version: Version,
  title: TaskFields.title.optional(),
  description: TaskFields.description.nullable().optional(),
  ownerId: TaskFields.ownerId.nullable().optional(),
  dueDate: TaskFields.dueDate.nullable().optional(),
  startDate: TaskFields.startDate.nullable().optional(),
  isMilestone: TaskFields.isMilestone.optional(),
  clientDependency: TaskFields.clientDependency.optional(),
  clientDependencyNote: TaskFields.clientDependencyNote.nullable().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  cancelReason: Note.optional(),
}).strict().refine((b) => b.status !== 'cancelled' || b.cancelReason !== undefined, {
  message: 'A reason is required to cancel a task',
  path: ['cancelReason'],
});

// ---------------------------------------------------------------------------
// Response DTOs (camelCase)
// ---------------------------------------------------------------------------
export interface TaskDto {
  id: string;
  projectId: string;
  version: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: string | null;
  /** FX-BE-C6: SCR-DEV-007 "Start date" (YYYY-MM-DD) or null. */
  startDate: string | null;
  isMilestone: boolean;
  /** "Client dependency" chip. Never a status, never a column. */
  clientDependency: boolean;
  clientDependencyNote: string | null;
  sortOrder: number;
  completedAt: string | null;
  cancelReason: string | null;
  allowedNextStatuses: TaskStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskCounts {
  total: number;
  open: number;
  done: number;
  cancelled: number;
}

export interface ProjectDto {
  id: string;
  code: string;
  version: number;
  dealId: string;
  dealCode: string | null;
  businessId: string;
  businessName: string | null;
  name: string;
  status: ProjectStatus;
  statusNote: string | null;
  startDate: string | null;
  targetDate: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  provisionedBy: 'auto' | 'manual';
  developers: { id: string; fullName: string }[];
  assignedToMe: boolean;
  /** Derived: target date passed and not delivered/completed. */
  deliveryOverdue: boolean;
  /** Completed projects are read-only. */
  readOnly: boolean;
  taskCounts: TaskCounts;
  allowedNextStatuses: ProjectStatus[];
  allowed: { changeStatus: boolean; editSchedule: boolean; assignDevelopers: boolean; reopen: boolean; createTask: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectHistoryDto {
  id: string;
  type: 'provisioned' | 'status_changed' | 'schedule_changed' | 'developer_assigned' | 'developer_unassigned';
  before: unknown;
  after: unknown;
  note: string | null;
  openTaskCount: number | null;
  actorId: string | null;
  at: string;
}

export interface ProjectDetailDto extends ProjectDto {
  tasks: TaskDto[];
  history: ProjectHistoryDto[];
}

export interface ProjectWorkloadDto {
  activeProjects: number;
  deliveryOverdue: number;
  openTasks: number;
  completedThisMonth: number;
}

/** "Closed deal without project" (derived). `failed` while J-07 retries; `dead` after the last retry. */
export interface UnprovisionedDealDto {
  dealId: string;
  dealCode: string;
  businessId: string;
  businessName: string | null;
  closedAt: string | null;
  provisioning: 'pending' | 'failed';
  attempts: number;
  lastErrorCode: string | null;
  nextAttemptAt: string | null;
}

export interface ProjectListResponse {
  items: ProjectDto[];
  page: number;
  pageSize: number;
  total: number;
  workload: ProjectWorkloadDto;
  unprovisioned: UnprovisionedDealDto[];
  policy: { autoProvision: boolean; label: string };
}

/** 422 RULE_VIOLATION `details` for the P7 dialog "Record delivered/completed with open tasks?". */
export interface OpenTasksWarningDetails {
  code: 'OPEN_TASKS_WARNING';
  from: ProjectStatus;
  to: ProjectStatus;
  openTaskCount: number;
  openTasks: { id: string; title: string; status: TaskStatus; clientDependency: boolean }[];
}
