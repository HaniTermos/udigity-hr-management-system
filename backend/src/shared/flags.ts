/**
 * Policy-flag registry (docs/policy-defaults.md; plan.md §6). Owner: Tech Lead.
 *
 * Every pending policy whose configurability is FLAG, CFG or SET has ONE entry here: its config key,
 * env variable, working default and label. None of them is approved: each carries
 * DEMO_LABEL ("Demonstration alternative — not approved"). The only approved rule (U-01, "Accepted
 * keeps the contact reservation") is code, not a flag, and is listed in plan.md §6.2.
 *
 * Kinds (policy-defaults "how configurable"):
 * - FLAG  feature flag, both branches are implemented; value from env.
 * - CFG   server config; value from env.
 * - SET   Owner setting (SCR-OWN-011 / settings rows owned by BE1). The env value is only the
 *         initial/default value; at runtime the owning module reads the stored setting first
 *         (BE1 `settingsService.get(key)`), falling back to this default.
 * `needsValue: true` = NEEDS VALUE in policy-defaults: the default is empty and the feature
 * reports "Not configured / policy pending" (HTTP 409 POLICY_NOT_CONFIGURED) until a value is saved.
 *
 * Usage: `import { flags } from '../../shared/flags.js'; if (flags['deals.closureMode'] === 'ownerVerify') ...`
 * Add a flag: post a REQUEST to the Tech Lead on docs/implementation/coordination.md.
 */
import { ConfigError } from '../config/index.js';

export const DEMO_LABEL = 'Demonstration alternative — not approved (docs/policy-defaults.md)';

export type FlagKind = 'FLAG' | 'CFG' | 'SET';
export type AgentId = 'BE1' | 'BE2' | 'BE3' | 'BE4' | 'BE5' | 'DevOps';

type Env = Record<string, string | undefined>;

export interface FlagDef<T> {
  /** policy-defaults row id, e.g. DEC-004. */
  policy: string;
  env: string;
  kind: FlagKind;
  owner: AgentId;
  default: T;
  needsValue?: boolean;
  label: typeof DEMO_LABEL;
  read(env: Env): T;
}

function base<T>(
  policy: string,
  env: string,
  kind: FlagKind,
  owner: AgentId,
  def: T,
  parse: (raw: string) => T,
  needsValue = false
): FlagDef<T> {
  return {
    policy,
    env,
    kind,
    owner,
    default: def,
    needsValue,
    label: DEMO_LABEL,
    read(e: Env) {
      const raw = e[env];
      if (raw === undefined || raw.trim() === '') return def;
      return parse(raw.trim());
    },
  };
}

function oneOf<const V extends readonly string[]>(
  policy: string, env: string, kind: FlagKind, owner: AgentId, values: V, def: V[number]
): FlagDef<V[number]> {
  return base(policy, env, kind, owner, def, (raw) => {
    if (!(values as readonly string[]).includes(raw)) throw new ConfigError(`${env} must be one of ${values.join(', ')}`);
    return raw as V[number];
  });
}

function int(policy: string, env: string, kind: FlagKind, owner: AgentId, def: number, min = 0): FlagDef<number> {
  return base(policy, env, kind, owner, def, (raw) => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < min || String(n) !== raw) throw new ConfigError(`${env} must be an integer >= ${min}`);
    return n;
  });
}

function num(policy: string, env: string, kind: FlagKind, owner: AgentId, def: number): FlagDef<number> {
  return base(policy, env, kind, owner, def, (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new ConfigError(`${env} must be a number`);
    return n;
  });
}

function bool(policy: string, env: string, kind: FlagKind, owner: AgentId, def: boolean): FlagDef<boolean> {
  return base(policy, env, kind, owner, def, (raw) => {
    if (raw !== 'true' && raw !== 'false') throw new ConfigError(`${env} must be true or false`);
    return raw === 'true';
  });
}

function list(policy: string, env: string, kind: FlagKind, owner: AgentId, def: string[], needsValue = false): FlagDef<string[]> {
  return base(policy, env, kind, owner, def, (raw) => raw.split(',').map((s) => s.trim()).filter(Boolean), needsValue);
}

function intList(policy: string, env: string, kind: FlagKind, owner: AgentId, def: number[]): FlagDef<number[]> {
  return base(policy, env, kind, owner, def, (raw) =>
    raw.split(',').map((s) => {
      const n = Number.parseInt(s.trim(), 10);
      if (!Number.isFinite(n) || n < 0) throw new ConfigError(`${env} must be a comma-separated list of integers`);
      return n;
    })
  );
}

function str(policy: string, env: string, kind: FlagKind, owner: AgentId, def: string, needsValue = false): FlagDef<string> {
  return base(policy, env, kind, owner, def, (raw) => raw, needsValue);
}

/**
 * The registry. Keys are stable config keys used in code, settings rows and plan.md §6.
 * Existing Increment 1 env names (OWNER_PENDING_2FA_SCOPE, SESSION_*, LOCKOUT_*, PASSWORD_*,
 * AUTH_RATE_LIMIT_*) are kept; `config/index.ts` remains the reader used by identity.
 */
export const POLICY_FLAGS = {
  // --- Identity (BE1) -------------------------------------------------------------------------
  'auth.ownerPending2faScope': oneOf('R-11', 'OWNER_PENDING_2FA_SCOPE', 'FLAG', 'BE1', ['R11-a', 'R11-b'] as const, 'R11-a'),
  'auth.sessionIdleMinutes': int('IMPL-SESSION', 'SESSION_IDLE_MINUTES', 'CFG', 'BE1', 120, 1),
  'auth.sessionAbsoluteHours': int('IMPL-SESSION', 'SESSION_ABSOLUTE_HOURS', 'CFG', 'BE1', 12, 1),
  'auth.sessionPending2faMinutes': int('IMPL-SESSION', 'SESSION_PENDING_2FA_MINUTES', 'CFG', 'BE1', 10, 1),
  'auth.lockoutMaxFailures': int('IMPL-LOCKOUT', 'LOCKOUT_MAX_FAILURES', 'CFG', 'BE1', 5, 1),
  'auth.lockoutWindowMinutes': int('IMPL-LOCKOUT', 'LOCKOUT_WINDOW_MINUTES', 'CFG', 'BE1', 15, 1),
  'auth.lockoutDurationMinutes': int('IMPL-LOCKOUT', 'LOCKOUT_DURATION_MINUTES', 'CFG', 'BE1', 15, 1),
  'auth.rateLimitMax': int('IMPL-LOCKOUT', 'AUTH_RATE_LIMIT_MAX', 'CFG', 'BE1', 20, 1),
  'auth.rateLimitWindowMinutes': int('IMPL-LOCKOUT', 'AUTH_RATE_LIMIT_WINDOW_MINUTES', 'CFG', 'BE1', 15, 1),
  'auth.passwordMinLength': int('IMPL-PASSWORD', 'PASSWORD_MIN_LENGTH', 'CFG', 'BE1', 12, 8),
  'auth.passwordResetTtlMinutes': int('IMPL-PASSWORD', 'PASSWORD_RESET_TTL_MINUTES', 'CFG', 'BE1', 30, 5),
  'auth.recoveryCodeCount': int('OQ-12/IMPL-2FA', 'POLICY_AUTH_RECOVERY_CODE_COUNT', 'CFG', 'BE1', 10, 1),

  // --- Company values (BE1, SCR-OWN-011) ------------------------------------------------------
  // FX-BE-C1: display name of the company (SCR-OWN-011 Company tab). Not a policy decision.
  'company.name': str('SCR-OWN-011', 'POLICY_COMPANY_NAME', 'SET', 'BE1', 'Udigity'),
  'company.timezone': str('DEC-007/VAL-TZ', 'POLICY_COMPANY_TIMEZONE', 'SET', 'BE1', '', true), // placeholder Asia/Beirut
  'business.defaultCountryCode': str('B2/VAL-CC', 'POLICY_BUSINESS_DEFAULT_COUNTRY_CODE', 'SET', 'BE2', '', true), // placeholder +961
  'deals.defaultCurrency': str('DEC-018/VAL-CURRENCY', 'POLICY_DEALS_DEFAULT_CURRENCY', 'SET', 'BE4', '', true), // placeholder USD

  // --- Attendance (BE1) -----------------------------------------------------------------------
  'attendance.workingDays': list('DEC-007/DEC-022', 'POLICY_ATTENDANCE_WORKING_DAYS', 'SET', 'BE1', ['MON', 'TUE', 'WED', 'THU', 'FRI']),
  // D1 (approved 2026-10-29): working days / start / timezone / office IPs / holidays are only pre-fill
  // suggestions here; attendance enforcement starts only after the Owner saves a complete settings
  // version. Shift end is derived (start + 9 h): POLICY_ATTENDANCE_SHIFT_END is removed.
  'attendance.shiftStart': str('DEC-007', 'POLICY_ATTENDANCE_SHIFT_START', 'SET', 'BE1', '09:00'),
  'attendance.graceMinutes': int('DEC-008', 'POLICY_ATTENDANCE_GRACE_MINUTES', 'SET', 'BE1', 10),
  // D2: the IP/CIDR allowlist is the only office check; `disabled` and the location modes fail at startup.
  'attendance.verificationMode': oneOf('DEC-009/D2', 'POLICY_ATTENDANCE_VERIFICATION_MODE', 'SET', 'BE1', ['ip'] as const, 'ip'),
  'attendance.officeIps': list('DEC-009/VAL-IP', 'POLICY_ATTENDANCE_OFFICE_IPS', 'SET', 'BE1', [], true),
  'attendance.holidays': list('DEC-022/VAL-HOLIDAYS', 'POLICY_ATTENDANCE_HOLIDAYS', 'SET', 'BE1', [], true),
  'attendance.remoteSelfRequest': bool('DEC-010', 'POLICY_ATTENDANCE_REMOTE_SELF_REQUEST', 'FLAG', 'BE1', false),
  'attendance.employeeRequests': bool('DEC-011', 'POLICY_ATTENDANCE_EMPLOYEE_REQUESTS', 'FLAG', 'BE1', true),
  // D6: the checkout summary is pinned (required, 10 non-whitespace characters); POLICY_ATTENDANCE_SUMMARY_*
  // are removed. D5: a failed-office-check checkout closes provisionally; `block`/`hold` fail at startup.
  'attendance.failedCheckout': oneOf('DEC-026/D5', 'POLICY_ATTENDANCE_FAILED_CHECKOUT', 'FLAG', 'BE1', ['provisional'] as const, 'provisional'),
  // Owner decision 2026-10-29 (supersedes DEC-033 "no break tracking"): breaks are on. false = the break
  // routes answer 404 and the timer is hidden.
  'attendance.breaksEnabled': bool('DEC-033/2026-10-29', 'POLICY_ATTENDANCE_BREAKS_ENABLED', 'CFG', 'BE1', true),
  // FX-BE breaks (user decision 2026-10-28): allowance per session and a cap on break count.
  'attendance.breakAllowanceMinutes': int('ATT-BREAKS', 'POLICY_ATTENDANCE_BREAK_ALLOWANCE_MINUTES', 'SET', 'BE1', 60, 0),
  // Owner decision 2026-10-29: 60 minutes in total and at most 3 breaks per session (Owner-editable).
  'attendance.maxBreaksPerSession': int('ATT-BREAKS', 'POLICY_ATTENDANCE_MAX_BREAKS_PER_SESSION', 'SET', 'BE1', 3, 1),
  'attendance.missingCheckoutFlagHours': int('D5', 'POLICY_ATTENDANCE_MISSING_CHECKOUT_FLAG_HOURS', 'SET', 'BE1', 6),

  // --- Work / targets (BE1) -------------------------------------------------------------------
  // D8 (policy baseline 2026-10-29): queue cap = current eligible assigned businesses per agent (not a
  // per-day count, not a quota). Replaces work.autofillPerAgentPerDay; a value an Owner saved under the
  // old key is still read by MOD-assignment as a fallback. No scheduled auto-fill in v1 (flag removed).
  'work.autofillQueueCap': int('D8', 'POLICY_WORK_AUTOFILL_QUEUE_CAP', 'SET', 'BE1', 40, 1),

  // --- Visibility / access (BE2) --------------------------------------------------------------
  // D9 (approved 2026-10-29): 15 elapsed days from creation / assignment; interactions never reset it. The DEC-001
  // `inactivity` basis is retired: setting it fails at startup (ConfigError) instead of silently changing access.
  'visibility.timerBasis': oneOf('DEC-001/D9', 'POLICY_VISIBILITY_TIMER_BASIS', 'FLAG', 'BE2', ['creation'] as const, 'creation'),
  'visibility.dec002Rows': list('DEC-002', 'POLICY_VISIBILITY_DEC002_ROWS', 'CFG', 'BE2', ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']),
  'visibility.callbackGraceHours': int('DEC-002 row 5', 'POLICY_VISIBILITY_CALLBACK_GRACE_HOURS', 'CFG', 'BE2', 48),
  'visibility.completedProjectDays': int('DEC-002 row 4/OI-18', 'POLICY_VISIBILITY_COMPLETED_PROJECT_DAYS', 'CFG', 'BE2', 15),
  'access.dataEntryScope': oneOf('OI-02', 'POLICY_ACCESS_DATA_ENTRY_SCOPE', 'FLAG', 'BE2', ['DE-1', 'DE-2'] as const, 'DE-1'),
  'access.auditOwnerHiddenReads': bool('OI-05', 'POLICY_ACCESS_AUDIT_OWNER_HIDDEN_READS', 'SET', 'BE2', true),

  // --- Businesses (BE2) -----------------------------------------------------------------------
  'duplicates.nameSimilarityThreshold': num('DEC-013', 'POLICY_DUPLICATES_NAME_SIMILARITY_THRESHOLD', 'SET', 'BE2', 0.6),
  // D12 (approved 2026-10-29): category management is Owner only; the DEC-015 `categories.dataEntryManage` toggle
  // (POLICY_CATEGORIES_DATA_ENTRY_MANAGE) is removed: a future delegation needs an explicit policy change.
  'social.platforms': list('DEC-024', 'POLICY_SOCIAL_PLATFORMS', 'SET', 'BE2', ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'youtube', 'other']),

  // --- Calling (BE3) --------------------------------------------------------------------------
  'reservation.leaseSeconds': int('DEC-004', 'POLICY_RESERVATION_LEASE_SECONDS', 'SET', 'BE3', 300, 30),
  'reservation.heartbeatSeconds': int('DEC-004', 'POLICY_RESERVATION_HEARTBEAT_SECONDS', 'SET', 'BE3', 60, 10),
  'reservation.idleMinutes': int('DEC-004', 'POLICY_RESERVATION_IDLE_MINUTES', 'SET', 'BE3', 15, 1),
  'reservation.idleWarningMinutes': int('DEC-004', 'POLICY_RESERVATION_IDLE_WARNING_MINUTES', 'SET', 'BE3', 13, 1),
  'reservation.maxTotalMinutes': int('DEC-004', 'POLICY_RESERVATION_MAX_TOTAL_MINUTES', 'SET', 'BE3', 60, 1),
  'reservation.ownerOverride': bool('DEC-004/B3-Q14', 'POLICY_RESERVATION_OWNER_OVERRIDE', 'SET', 'BE3', true),
  'calls.saveAfterReservationLoss': oneOf('B3-Q05', 'POLICY_CALLS_SAVE_AFTER_RESERVATION_LOSS', 'FLAG', 'BE3',
    ['keepAttemptOnly', 'reject'] as const, 'keepAttemptOnly'),
  'calls.acceptedNoteMinLength': int('B3-Q16/OQ-01', 'POLICY_CALLS_ACCEPTED_NOTE_MIN_LENGTH', 'SET', 'BE3', 10),
  // R2-11 / R3-09: the latest a follow-up may be scheduled, in days from now (caps row-5 context access).
  'followUps.maxScheduleDays': int('R2-11', 'POLICY_FOLLOWUPS_MAX_SCHEDULE_DAYS', 'CFG', 'BE3', 90, 1),
  'followUps.overdueMinutes': int('Overdue threshold', 'POLICY_FOLLOWUPS_OVERDUE_MINUTES', 'SET', 'BE3', 60),

  // --- Deals / projects (BE4) -----------------------------------------------------------------
  'deals.developerPreClosure': oneOf('DEC-005', 'POLICY_DEALS_DEVELOPER_PRE_CLOSURE', 'FLAG', 'BE4', ['assigned', 'closedOnly'] as const, 'assigned'),
  // D16 (approved 2026-10-29): only Owner verification closes a deal; the Developer-finalizes `direct` mode is retired.
  'deals.closureMode': oneOf('DEC-006/D16', 'POLICY_DEALS_CLOSURE_MODE', 'FLAG', 'BE4', ['ownerVerify'] as const, 'ownerVerify'),
  // OQ-15 (unresolved), ORCH-2 item 2: where Owner "Reopen" sends a Not proceeding deal.
  'deals.reopenTarget': oneOf('OQ-15', 'POLICY_DEALS_REOPEN_TARGET', 'FLAG', 'BE4',
    ['accepted_opportunity', 'previous_stage'] as const, 'accepted_opportunity'),
  'deals.currencies': list('DEC-018', 'POLICY_DEALS_CURRENCIES', 'SET', 'BE4', [], true),
  'projects.autoProvision': bool('F2', 'POLICY_PROJECTS_AUTO_PROVISION', 'FLAG', 'BE4', true),

  // --- Notifications (BE5) — NOTIF / D18 ------------------------------------------------------
  'notifications.inApp': bool('NOTIF/AR-14', 'POLICY_NOTIFICATIONS_IN_APP', 'SET', 'BE5', true),
  'notifications.followUpLeadMinutes': int('NOTIF', 'POLICY_NOTIFICATIONS_FOLLOWUP_LEAD_MINUTES', 'SET', 'BE5', 15),
  'notifications.followUpOverdueAlertMinutes': int('NOTIF', 'POLICY_NOTIFICATIONS_FOLLOWUP_OVERDUE_ALERT_MINUTES', 'SET', 'BE5', 60),
  'notifications.meetingLeadMinutes': intList('NOTIF', 'POLICY_NOTIFICATIONS_MEETING_LEAD_MINUTES', 'SET', 'BE5', [1440, 60]),
  'notifications.missingCheckinAfterGraceMinutes': int('NOTIF/F-05', 'POLICY_NOTIFICATIONS_MISSING_CHECKIN_AFTER_GRACE_MINUTES', 'SET', 'BE5', 30),
  'notifications.missingCheckoutAfterShiftMinutes': int('NOTIF/F-05', 'POLICY_NOTIFICATIONS_MISSING_CHECKOUT_AFTER_SHIFT_MINUTES', 'SET', 'BE5', 60),
  'notifications.emailRetrySeconds': intList('NOTIF', 'POLICY_NOTIFICATIONS_EMAIL_RETRY_SECONDS', 'SET', 'BE5', [60, 600, 3600]),
  'notifications.notifyPreviousAssignee': bool('OWN-008', 'POLICY_NOTIFICATIONS_NOTIFY_PREVIOUS_ASSIGNEE', 'SET', 'BE5', true),
  'notifications.lateReminder': oneOf('B3-Q08', 'POLICY_NOTIFICATIONS_LATE_REMINDER', 'CFG', 'BE5', ['sendIfEventFuture', 'skip'] as const, 'sendIfEventFuture'),

  // --- Reports / audit (BE5, BE1) -------------------------------------------------------------
  'audit.exportEnabled': bool('OQ-18', 'POLICY_AUDIT_EXPORT_ENABLED', 'FLAG', 'BE1', false),

  // --- Retention (BE5 J-12) and backups (DevOps) ----------------------------------------------
  'retention.sessionsDays': int('C3', 'POLICY_RETENTION_SESSIONS_DAYS', 'CFG', 'BE5', 90, 1),
  'retention.reservationsDays': int('C3', 'POLICY_RETENTION_RESERVATIONS_DAYS', 'CFG', 'BE5', 90, 1),
  'retention.notificationsDays': int('C3', 'POLICY_RETENTION_NOTIFICATIONS_DAYS', 'CFG', 'BE5', 180, 1),
  'retention.jobsDays': int('C3', 'POLICY_RETENTION_JOBS_DAYS', 'CFG', 'BE5', 30, 1),
  'retention.tokensDays': int('C3', 'POLICY_RETENTION_TOKENS_DAYS', 'CFG', 'BE5', 30, 1),
  'retention.idempotencyHours': int('C3', 'POLICY_RETENTION_IDEMPOTENCY_HOURS', 'CFG', 'BE5', 48, 1),
  'backup.retentionDaily': int('C1', 'POLICY_BACKUP_RETENTION_DAILY', 'CFG', 'DevOps', 14, 1),
  'backup.retentionWeekly': int('C1', 'POLICY_BACKUP_RETENTION_WEEKLY', 'CFG', 'DevOps', 8, 1),
  'backup.retentionMonthly': int('C1', 'POLICY_BACKUP_RETENTION_MONTHLY', 'CFG', 'DevOps', 6, 1),
} as const;

export type FlagKey = keyof typeof POLICY_FLAGS;
export type PolicyFlags = { readonly [K in FlagKey]: ReturnType<(typeof POLICY_FLAGS)[K]['read']> };

/** Parse every flag from `env`. Throws ConfigError on an invalid value (fail at startup, not at use). */
export function loadPolicyFlags(env: Env): PolicyFlags {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(POLICY_FLAGS)) {
    out[key] = (def as FlagDef<unknown>).read(env);
  }
  return Object.freeze(out) as PolicyFlags;
}

/** Env-level values (defaults for SET kinds). */
export const flags: PolicyFlags = loadPolicyFlags(process.env);

/** Registry rows for the settings screen / diagnostics. Never includes secrets. */
export function describeFlags(values: PolicyFlags = flags) {
  return (Object.keys(POLICY_FLAGS) as FlagKey[]).map((key) => {
    const def = POLICY_FLAGS[key] as FlagDef<unknown>;
    const value = values[key];
    const empty = value === '' || (Array.isArray(value) && value.length === 0);
    return {
      key,
      policy: def.policy,
      kind: def.kind,
      owner: def.owner,
      value,
      default: def.default,
      configured: !(def.needsValue && empty),
      label: def.label,
    };
  });
}
