/**
 * Roles & Permissions API client — backend MOD-access. Owner: FE2.
 * Screens: SCR-OWN-012 (Roles & Permissions Studio).
 */
import { api, newIdempotencyKey } from './client';

export type DataScope = 'self' | 'department' | 'global' | 'assigned_only';

export interface PermissionCatalogItem {
  action: string;
  module: string;
  displayName: string;
  description: string;
  requiresAdmin: boolean;
  allowedScopes: DataScope[];
}

export interface RolePermissionDto {
  action: string;
  dataScope: DataScope;
}

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  employeeCount: number;
  permissions: RolePermissionDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleInput {
  id: string;
  name: string;
  description?: string | null;
  permissions: RolePermissionDto[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  permissions?: RolePermissionDto[];
}

export const rolesPaths = {
  roles: '/api/access/roles',
  role: (id: string) => `/api/access/roles/${encodeURIComponent(id)}`,
  permissions: '/api/access/permissions',
} as const;

export async function listRoles(): Promise<RoleSummary[]> {
  const res = await api.get<{ roles: RoleSummary[] }>(rolesPaths.roles);
  return res.roles;
}

export async function getRole(id: string): Promise<RoleDetail> {
  const res = await api.get<{ role: RoleDetail }>(rolesPaths.role(id));
  return res.role;
}

export async function createRole(input: CreateRoleInput): Promise<RoleDetail> {
  const res = await api.post<{ role: RoleDetail }>(rolesPaths.roles, input, {
    idempotencyKey: newIdempotencyKey(),
  });
  return res.role;
}

export async function updateRole(id: string, input: UpdateRoleInput): Promise<RoleDetail> {
  const res = await api.patch<{ role: RoleDetail }>(rolesPaths.role(id), input, {
    idempotencyKey: newIdempotencyKey(),
  });
  return res.role;
}

export async function deleteRole(id: string): Promise<void> {
  await api.del(rolesPaths.role(id), undefined, {
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function listPermissions(): Promise<PermissionCatalogItem[]> {
  const res = await api.get<{ permissions: PermissionCatalogItem[] }>(rolesPaths.permissions);
  return res.permissions;
}
