/**
 * MOD-employees — Zod request schemas (.strict()), DTOs and VT-3 action declarations. Owner: BE1.
 * authz-matrix §3.2: the directory and every employee command are Owner only (Confirmed), 2FA complete.
 */
import { z } from 'zod';
import { defineActions } from '../../shared/access.js';
import { defineMatrixActions } from '../access/schemas.js';
import { PageQuerySchema } from '../../shared/pagination.js';
import type { Role } from '../../middleware/auth.js';

/** authz-matrix §3.2, declared FROM the matrix so names and roles cannot drift (SEC R3). */
export const EMPLOYEE_ACTIONS = defineMatrixActions([
  'employee.list',
  'employee.read',
  'employee.create',
  'employee.update',
  'employee.deactivate',
  'employee.activate',
  // GET /api/employees/me (own profile, SHR-006)
  'profile.read',
  'profile.update',
] as const);

/** Not a matrix row (it is part of the deactivate impact view, §3.2 note); Security Lead may add it. */
export const EMPLOYEE_EXTRA_ACTIONS = defineActions({
  'employee.read_open_items': { roles: ['owner'], admin: true, description: 'Open work of an employee (OWN-003 impact)' },
});

export const ROLES = ['owner', 'data_entry', 'call_center', 'developer'] as const satisfies readonly Role[];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v === null || v === '' ? null : v))
    .optional();

export const IdParamSchema = z.object({ id: z.string().uuid() }).strict();

export const RoleSchema = z.string().trim().min(1).max(50);

export const CreateEmployeeSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    fullName: z.string().trim().min(1).max(255),
    role: RoleSchema,
    phone: optionalText(50),
    department: optionalText(100),
    jobTitle: optionalText(100),
  })
  .strict();

export const UpdateEmployeeSchema = z
  .object({
    version: z.number().int().positive(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    fullName: z.string().trim().min(1).max(255).optional(),
    role: RoleSchema.optional(),
    phone: optionalText(50),
    department: optionalText(100),
    jobTitle: optionalText(100),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const StatusBodySchema = z
  .object({
    isActive: z.boolean(),
    version: z.number().int().positive(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const EmployeeListQuerySchema = PageQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  role: z.string().trim().max(50).optional(),
  status: z.enum(['active', 'deactivated', '']).optional(),
}).strict();

export type EmployeeListQuery = z.infer<typeof EmployeeListQuerySchema>;
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

/**
 * Counts per module (`openItemsFor`). `null` = that module does not expose its open items yet
 * (listed in `unavailable`), never a guessed 0.
 */
export interface OpenItemCounts {
  assignments: number | null;
  followUps: number | null;
  corrections: number | null;
  deals: number | null;
  projects: number | null;
  openTasks: number | null;
  openAttendanceSessions: number | null;
}

export interface EmployeeDto {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeRowDto extends EmployeeDto {
  twoFactorEnrolled: boolean;
  sessions: { activeCount: number; activeSince: string | null; lastSignOutAt: string | null };
  /** OWN-002 "Open work" column: same shape as GET /:id/open-items (`null` = not available yet, never 0). */
  openWork: OpenItemCounts & { unavailable: string[] };
  /** OWN-002 "Missing checkout" flag (D5: open past shift end + flag hours, or flagged by J-04). */
  missingCheckout: boolean;
  /** Start of the employee's open attendance session, if any (ISO). */
  openAttendanceSince: string | null;
}
