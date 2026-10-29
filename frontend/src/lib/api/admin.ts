/**
 * admin API — backend MOD-admin (BE1). Owner: FE2.
 * Screens: SCR-OWN-010 audit explorer, SCR-OWN-011 settings.
 * DTOs mirror BE1-C1 (backend `modules/admin/schemas.ts`, `service.ts`).
 */
import { api } from './client';
import type { IsoDateTime, Page, PageQuery } from './types';

export const adminPaths = {
  auditEvents: '/api/audit-events',
  settings: '/api/settings',
  flags: '/api/settings/flags',
} as const;

/* ---------------- audit (SCR-OWN-010) ---------------- */
export interface AuditEventRow {
  id: string;
  occurredAt: IsoDateTime;
  eventName: string;
  /** True when the event name is a placeholder awaiting approval (G2). */
  placeholderName: boolean;
  actorId: string | null;
  actorName: string | null;
  /** A role, `system` for scheduled jobs, or null. */
  actorRole: string | null;
  entityType: string;
  entityId: string | null;
  sessionId?: string | null;
  requestId: string | null;
  clientIp?: string | null;
  payload: unknown;
  before: unknown;
  after: unknown;
  reason: string | null;
  sourceWorkflow: string | null;
  createdAt?: IsoDateTime;
}

export interface AuditQuery extends PageQuery {
  event?: string;
  actorId?: string;
  entityType?: string;
  /** Business, employee or record reference (BE1 accepts `entityRef` as an alias of `entityId`). */
  entityRef?: string;
  sort?: 'createdAt' | 'eventName';
  /** `YYYY-MM-DD` company date. */
  from?: string;
  to?: string;
}

export function auditKey(q: AuditQuery): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${adminPaths.auditEvents}?${s}` : adminPaths.auditEvents;
}

export async function listAuditEvents(q: AuditQuery = {}): Promise<Page<AuditEventRow>> {
  return api.get<Page<AuditEventRow>>(adminPaths.auditEvents, { query: { ...q } });
}

/* ---------------- settings (SCR-OWN-011) ---------------- */
export type SettingScalar = string | number | boolean | null;
export type FlagKind = 'FLAG' | 'CFG' | 'SET';

/** One row of the policy registry (`settings[]` in GET /settings and `flags[]` in GET /settings/flags). */
export interface PolicyFlagRow {
  key: string;
  policy: string;
  kind: FlagKind;
  owner: string;
  value: unknown;
  default: unknown;
  source: 'stored' | 'env';
  configured: boolean;
  /** False for FLAG/CFG rows and for `attendance.*` (edited on the attendance settings in Inc 3). */
  editable: boolean;
  label: string;
}

/** Owner view of GET /settings. Other roles only get `{label, company:{'company.timezone'}, configured}`. */
export interface SettingsDto {
  version: number;
  updatedAt?: IsoDateTime | null;
  label?: string;
  /** `company.*` values keyed by their full key, e.g. `company.timezone`. */
  company: Record<string, SettingScalar>;
  /** Other SET keys. */
  policies: Record<string, unknown>;
  settings?: PolicyFlagRow[];
  configured?: boolean;
}

export interface SettingsPatch {
  version: number;
  company?: Record<string, SettingScalar>;
  policies?: Record<string, unknown>;
  /** `null` resets a key to its env default. */
  reason?: string;
}

export async function getSettings(): Promise<SettingsDto> {
  return api.get<SettingsDto>(adminPaths.settings);
}

export async function patchSettings(input: SettingsPatch): Promise<SettingsDto> {
  return api.patch<SettingsDto>(adminPaths.settings, input);
}

export async function listPolicyFlags(): Promise<PolicyFlagRow[]> {
  const res = await api.get<{ label: string; flags: PolicyFlagRow[] }>(adminPaths.flags);
  return res.flags;
}

/* ---------------- attendance settings (SCR-OWN-011 working hours) ---------------- */
export type WeekdayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

/** `current` of GET /api/attendance/settings (Owner view). Fields can be empty while the schedule is not configured. */
export interface AttendanceSettingsCurrent {
  versionNo: number | null;
  timezone: string | null;
  workingDays: WeekdayCode[];
  shiftStart: string | null;
  shiftEnd: string | null;
  graceMinutes: number | null;
  verificationMode: string | null;
  officeIps?: string[];
  officeHostnames?: string[];
  holidays?: string[];
  /** D1: the Owner confirmed the holiday list (possibly empty). */
  holidaysConfirmed?: boolean;
  summaryRequired?: boolean;
  summaryMinLength?: number;
  missingCheckoutFlagHours?: number;
}

export interface AttendanceSettingsDto {
  label?: string;
  configured: boolean;
  missing?: string[];
  current: AttendanceSettingsCurrent;
  /** Break tracking (Owner decision 2026-10-29): on/off and the per-session limits. */
  breaks?: { enabled: boolean; allowanceMinutes: number; maxPerSession: number };
}

/**
 * Only the fields the form edits; on a later save the server keeps every omitted field. D1: the first save must
 * state timezone, working days, shift start, office IPs, holidays and `holidaysConfirmed: true`. No shift end
 * (derived: start + 9 h) and no summary rule (pinned).
 */
export interface AttendanceSettingsPut {
  version: number;
  timezone?: string;
  workingDays?: WeekdayCode[];
  shiftStart?: string;
  graceMinutes?: number;
  verificationMode?: 'ip';
  officeIps?: string[];
  /** Dynamic-DNS names of the office router (no static IP); max 5. */
  officeHostnames?: string[];
  holidays?: string[];
  holidaysConfirmed?: boolean;
  breakAllowanceMinutes?: number;
  maxBreaksPerSession?: number;
  reason?: string;
}

export const attendanceSettingsPath = '/api/attendance/settings';

export async function getAttendanceSettings(): Promise<AttendanceSettingsDto> {
  return api.get<AttendanceSettingsDto>(attendanceSettingsPath);
}

export async function putAttendanceSettings(input: AttendanceSettingsPut): Promise<unknown> {
  return api.put<unknown>(attendanceSettingsPath, input);
}
