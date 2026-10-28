/**
 * MOD-access dynamic RBAC schemas. Owner: BE2.
 * Zod validation for custom roles and their grants (migration 014; authz-matrix.md §3.11).
 *
 * Shape validation lives here; the matrix rules (action exists, not a nobody-row, privileged rows only
 * when `grantable`) are applied in `dynamicService.validateGrants`, so one place answers "grantable?".
 */
import { z } from 'zod';
import { DATA_SCOPES, type DataScope } from '../../shared/access.js';

export const DataScopeSchema = z.enum(DATA_SCOPES as [DataScope, ...DataScope[]]);
export type { DataScope };

/** Matrix action names are `<area>.<verb>[.<qualifier>]` in lower snake case. */
const ACTION_NAME = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,2}$/;

export const RolePermissionInputSchema = z
  .object({
    action: z.string().trim().min(3).max(100).regex(ACTION_NAME, 'Action must be a matrix action name such as business.read'),
    dataScope: DataScopeSchema.default('global'),
  })
  .strict();

const PermissionsSchema = z
  .array(RolePermissionInputSchema)
  .max(200)
  .superRefine((list, ctx) => {
    const seen = new Set<string>();
    for (const p of list) {
      if (seen.has(p.action)) ctx.addIssue({ code: 'custom', message: `Duplicate grant for ${p.action}` });
      seen.add(p.action);
    }
  });

export const CreateRoleSchema = z
  .object({
    id: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9_-]+$/, 'Role ID must contain only lowercase alphanumeric characters, dashes, or underscores'),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).nullish(),
    permissions: PermissionsSchema.default([]),
  })
  .strict();

export const UpdateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullish(),
    permissions: PermissionsSchema.optional(),
    /** IC-16: the version the client last saw. Optional until SCR-OWN-012 is wired; mismatch → 409 VERSION_CONFLICT. */
    version: z.number().int().positive().optional(),
  })
  .strict();

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type RolePermissionInput = z.infer<typeof RolePermissionInputSchema>;

export interface PermissionCatalogItem {
  action: string;
  module: string;
  displayName: string;
  description: string;
  /** Owner-only administrative row (matrix `admin`). */
  requiresAdmin: boolean;
  /** Whether a custom role may hold this action at all (§3.11). False for unmarked admin rows and nobody-rows. */
  grantable: boolean;
  allowedScopes: DataScope[];
}

export interface RoleDetailDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  /** IC-16 optimistic-concurrency version (migration 960). */
  version: number;
  employeeCount: number;
  permissions: {
    action: string;
    dataScope: DataScope;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleSummaryDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  version: number;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}
