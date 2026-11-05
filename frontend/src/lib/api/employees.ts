/**
 * employees API — backend MOD-employees (BE1). Owner: FE2.
 * Screens: SCR-OWN-002/003; FE1 uses `me` for SCR-SHR-006.
 * DTOs mirror BE1-C1 (backend `modules/employees/schemas.ts`).
 */
import { api, newIdempotencyKey } from './client';
import type { IsoDateTime, Page, PageQuery, Role, Versioned } from './types';

export const employeesPaths = {
  list: '/api/employees',
  me: '/api/employees/me',
  detail: (id: string) => `/api/employees/${id}`,
  status: (id: string) => `/api/employees/${id}/status`,
  openItems: (id: string) => `/api/employees/${id}/open-items`,
} as const;

/**
 * Counts composed at the API edge from each module's `openItemsFor`. `null` = that module does not
 * expose its open items yet (also listed in `unavailable`): render "Not available yet", never 0.
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

export interface OpenItemsDto extends OpenItemCounts {
  unavailable: string[];
}

export interface EmployeeRow extends Versioned {
  email: string;
  fullName: string;
  role: Role;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  twoFactorEnrolled: boolean;
  sessions: { activeCount: number; activeSince: IsoDateTime | null; lastSignOutAt: IsoDateTime | null };
  /** BE1-C2: OWN-002 "Open work" column. `null` counts = not available (never 0). */
  openWork: OpenItemsDto;
  /** OWN-002 "Missing checkout" badge. */
  missingCheckout: boolean;
  openAttendanceSince: IsoDateTime | null;
}

export interface EmployeeListQuery extends PageQuery {
  q?: string;
  role?: Role | '';
  status?: 'active' | 'deactivated' | '';
}

export interface EmployeeProfileInput {
  fullName: string;
  email: string;
  phone?: string | null;
  department?: string | null;
  jobTitle?: string | null;
}
export interface CreateEmployeeInput extends EmployeeProfileInput {
  role: Role;
}
export interface UpdateEmployeeInput extends Partial<EmployeeProfileInput> {
  role?: Role;
  version: number;
  reason?: string;
}

/** SWR key per filter set (the full path, as `swrFetcher` expects). */
export function employeesListKey(q: EmployeeListQuery): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${employeesPaths.list}?${s}` : employeesPaths.list;
}

export async function listEmployees(q: EmployeeListQuery = {}): Promise<Page<EmployeeRow>> {
  // BE1-C1: `Page<EmployeeRow>` (plus a legacy `employees` key that is ignored).
  return api.get<Page<EmployeeRow>>(employeesPaths.list, { query: { ...q } });
}

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeRow> {
  return api.post<EmployeeRow>(employeesPaths.list, input, { idempotencyKey: newIdempotencyKey() });
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<EmployeeRow> {
  return api.patch<EmployeeRow>(employeesPaths.detail(id), input);
}

export async function setEmployeeActive(
  id: string,
  input: { isActive: boolean; version: number; reason?: string },
): Promise<EmployeeRow> {
  // BE1-C1: `{ employee }`.
  const res = await api.patch<{ employee: EmployeeRow }>(employeesPaths.status(id), input);
  return res.employee;
}

export async function getOpenItems(id: string): Promise<OpenItemsDto> {
  return api.get<OpenItemsDto>(employeesPaths.openItems(id));
}
