/**
 * MOD-admin — service (company settings, audit read). Owner: BE1.
 *
 * `getSetting(db, key)` is THE reader of policy values for every module (plan.md §6):
 *   SET kinds: the Owner-saved value (company_settings) first, else the env default.
 *   FLAG/CFG kinds: the env value from shared/flags.ts.
 * Env default precedence for three keys (DEV-R4): POLICY_* name, else the DevOps alias
 * (COMPANY_TIMEZONE, OFFICE_IP_ALLOWLIST, ATTENDANCE_OFFICE_MODE), else the registry default.
 * Every value is a Demonstration alternative — not approved (docs/policy-defaults.md).
 */
import type { Queryable } from '../../db/pool.js';
import { ConfigError } from '../../config/index.js';
import { DEMO_LABEL, POLICY_FLAGS, flags, type FlagDef, type FlagKey, type PolicyFlags } from '../../shared/flags.js';
import { HttpError, versionConflict } from '../../shared/errors.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import { be1Env, isValidTimeZone } from '../identity/env.js';
import { listAuditEvents, readCompanySettings, writeCompanySettings } from './repo.js';
import type { AuditQuery } from './schemas.js';

const defOf = (key: FlagKey) => POLICY_FLAGS[key] as FlagDef<unknown>;

/**
 * Keys the Owner edits on SCR-OWN-011 through PATCH /api/settings: every SET-kind key except the
 * attendance schedule/verification keys, which are versioned by attendance settings (Inc 3,
 * PUT /api/attendance/settings).
 */
export function isEditableSetting(key: string): key is FlagKey {
  if (!Object.prototype.hasOwnProperty.call(POLICY_FLAGS, key)) return false;
  const def = defOf(key as FlagKey);
  return def.kind === 'SET' && !key.startsWith('attendance.');
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Env-level value with the DEV-R4 alias fallback (alias only replaces an unset POLICY_* value). */
export function envDefault<K extends FlagKey>(key: K): PolicyFlags[K] {
  return envDefaultFrom(key, flags, be1Env.aliases);
}

/** `envDefault` over explicit inputs, so the POLICY_* / alias precedence is testable without process.env. */
export function envDefaultFrom<K extends FlagKey>(
  key: K,
  values: PolicyFlags,
  a: typeof be1Env.aliases
): PolicyFlags[K] {
  const value = values[key];
  const def = defOf(key);
  const atDefault = sameValue(value, def.default);
  if (atDefault) {
    if (key === 'company.timezone' && a.companyTimezone) return a.companyTimezone as PolicyFlags[K];
    if (key === 'attendance.officeIps' && a.officeIps.length > 0) return a.officeIps as PolicyFlags[K];
    if (key === 'attendance.verificationMode' && a.verificationMode) return a.verificationMode as PolicyFlags[K];
  }
  return value;
}

/** Parse a JSON value through the registry's own env parser, so stored and env values follow one rule. */
export function parseSettingValue(key: FlagKey, raw: unknown): unknown {
  const def = defOf(key);
  const asText = Array.isArray(raw) ? raw.map(String).join(',') : raw === null || raw === undefined ? '' : String(raw);
  let value: unknown;
  try {
    value = def.read({ [def.env]: asText });
  } catch (e) {
    if (e instanceof ConfigError) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { [key]: [e.message.replace(def.env, key)] });
    }
    throw e;
  }
  if (key === 'company.name' && typeof value === 'string') {
    const name = value.trim();
    if (name.length < 1 || name.length > 120 || [...name].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { [key]: ['Enter a company name of 1 to 120 characters'] });
    }
    return name;
  }
  if (key === 'company.timezone' && typeof value === 'string' && value !== '' && !isValidTimeZone(value)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { [key]: ['Must be an IANA time zone, e.g. Asia/Beirut'] });
  }
  return value;
}

function storedValue(stored: Record<string, unknown>, key: FlagKey): { found: boolean; value: unknown } {
  if (!Object.prototype.hasOwnProperty.call(stored, key)) return { found: false, value: undefined };
  try {
    return { found: true, value: parseSettingValue(key, stored[key]) };
  } catch {
    // A stored value that no longer parses (registry changed) is ignored: env default applies.
    return { found: false, value: undefined };
  }
}

/** Effective value of a policy flag/setting. */
export async function getSetting<K extends FlagKey>(db: Queryable, key: K): Promise<PolicyFlags[K]> {
  if (defOf(key).kind !== 'SET') return flags[key];
  const row = await readCompanySettings(db);
  const s = storedValue(row.values, key);
  return (s.found ? s.value : envDefault(key)) as PolicyFlags[K];
}

/**
 * /readyz in production (BL-16): the effective company timezone (Owner-saved value, else
 * POLICY_COMPANY_TIMEZONE, else the COMPANY_TIMEZONE alias) must be a valid IANA zone.
 * Returns the problem, or null when the value is usable.
 */
export function companyTimezoneProblem(tz: unknown): string | null {
  const value = typeof tz === 'string' ? tz.trim() : '';
  if (!value) return 'company.timezone is not configured (set POLICY_COMPANY_TIMEZONE or save it in Settings)';
  if (!isValidTimeZone(value)) return 'company.timezone is not a valid IANA time zone';
  return null;
}

const isEmpty = (v: unknown) => v === '' || (Array.isArray(v) && v.length === 0);

export interface SettingRow {
  key: FlagKey;
  policy: string;
  kind: string;
  owner: string;
  value: unknown;
  default: unknown;
  source: 'stored' | 'env';
  configured: boolean;
  editable: boolean;
  /** Always "Demonstration alternative — not approved (docs/policy-defaults.md)". */
  label: typeof DEMO_LABEL;
}

function rowsFrom(stored: Record<string, unknown>, filter: (key: FlagKey) => boolean): SettingRow[] {
  return (Object.keys(POLICY_FLAGS) as FlagKey[]).filter(filter).map((key) => {
    const def = defOf(key);
    const s = def.kind === 'SET' ? storedValue(stored, key) : { found: false, value: undefined };
    const value = s.found ? s.value : def.kind === 'SET' ? envDefault(key) : flags[key];
    return {
      key,
      policy: def.policy,
      kind: def.kind,
      owner: def.owner,
      value,
      default: def.default,
      source: s.found ? 'stored' : 'env',
      configured: !(def.needsValue && isEmpty(value)),
      editable: isEditableSetting(key),
      label: def.label,
    };
  });
}

/** GET /api/settings (Owner): SET-kind values (SCR-OWN-011), as rows and as FE2's company/policies maps. */
export async function getSettingsView(db: Queryable) {
  const row = await readCompanySettings(db);
  const settings = rowsFrom(row.values, (k) => defOf(k).kind === 'SET');
  const company: Record<string, unknown> = {};
  const policies: Record<string, unknown> = {};
  for (const s of settings) (s.key.startsWith('company.') ? company : policies)[s.key] = s.value;
  return {
    version: row.version,
    updatedAt: new Date(row.updated_at).toISOString(),
    label: DEMO_LABEL,
    company,
    policies,
    settings,
  };
}

/**
 * GET /api/settings for non-Owners (and an Owner whose 2FA is pending under R11-b): only the
 * derived values the UI needs (authz §3.9), e.g. the company timezone for time display.
 */
export async function getPublicSettingsView(db: Queryable) {
  const tz = await getSetting(db, 'company.timezone');
  const name = await getSetting(db, 'company.name');
  return {
    label: DEMO_LABEL,
    company: { 'company.timezone': tz, 'company.name': name },
    configured: { 'company.timezone': tz !== '' },
  };
}

/** GET /api/settings/flags: every registry row with its effective value and label. */
export async function getFlagsView(db: Queryable) {
  const row = await readCompanySettings(db);
  return { label: DEMO_LABEL, flags: rowsFrom(row.values, () => true) };
}

/** PATCH /api/settings. One transaction: change + `settings.updated` audit with before/after. */
export async function updateSettings(
  ctx: CommandContext,
  input: { version: number; values: Record<string, unknown>; reason?: string }
) {
  const errors: Record<string, string[]> = {};
  const parsed: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input.values)) {
    if (!isEditableSetting(key)) {
      errors[key] = [Object.prototype.hasOwnProperty.call(POLICY_FLAGS, key) ? 'Not editable here' : 'Unknown setting'];
      continue;
    }
    if (raw === null) {
      parsed[key] = null;
      continue;
    }
    try {
      parsed[key] = parseSettingValue(key, raw);
    } catch (e) {
      if (e instanceof HttpError && e.details && typeof e.details === 'object') Object.assign(errors, e.details);
      else throw e;
    }
  }
  if (Object.keys(errors).length > 0) throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', errors);

  const current = await readCompanySettings(ctx.tx, true);
  if (current.version !== input.version) throw versionConflict(current.version, await getSettingsView(ctx.tx));

  const next: Record<string, unknown> = { ...current.values };
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed) as [FlagKey, unknown][]) {
    const prev = storedValue(current.values, key);
    const prevEffective = prev.found ? prev.value : envDefault(key);
    const nextEffective = value === null ? envDefault(key) : value;
    if (value === null) delete next[key];
    else next[key] = value;
    if (!sameValue(prevEffective, nextEffective) || prev.found !== (value !== null)) {
      before[key] = prevEffective;
      after[key] = nextEffective;
    }
  }

  if (Object.keys(after).length === 0) return getSettingsView(ctx.tx); // no-op repeat

  const written = await writeCompanySettings(ctx.tx, next, input.version, ctx.actor.kind === 'employee' ? ctx.actor.employeeId : '');
  if (!written) throw versionConflict((await readCompanySettings(ctx.tx)).version);
  await audit(ctx, {
    eventName: 'settings.updated',
    entityType: 'setting',
    entityId: 'company',
    before,
    after,
    reason: input.reason ?? null,
    payload: { keys: Object.keys(after), version: written.version },
    sourceWorkflow: 'SCR-OWN-011',
  });
  return getSettingsView(ctx.tx);
}

/**
 * Set one SET-kind company value inside the caller's transaction (no version check, no audit: the
 * caller's command audits the whole change). Used by attendance settings to keep `company.timezone`
 * equal to the saved attendance settings version (WF-ADMIN-001).
 */
export async function setCompanyValue(ctx: CommandContext, key: FlagKey, raw: unknown): Promise<void> {
  const value = parseSettingValue(key, raw);
  const current = await readCompanySettings(ctx.tx, true);
  if (sameValue(current.values[key], value)) return;
  const next = { ...current.values, [key]: value };
  const written = await writeCompanySettings(ctx.tx, next, current.version, ctx.actor.kind === 'employee' ? ctx.actor.employeeId : '');
  if (!written) throw versionConflict((await readCompanySettings(ctx.tx)).version);
}

/**
 * C-18 / D7: a YYYY-MM-DD `from` / `to` is a company-timezone calendar day (UTC when no timezone is
 * configured): `from` = that day's 00:00, `to` = the NEXT day's 00:00 (exclusive). The repo then only sees instants.
 */
export async function listAudit(db: Queryable, q: AuditQuery) {
  const dateOnly = (v?: string) => v !== undefined && v.length === 10;
  if (!dateOnly(q.from) && !dateOnly(q.to)) return listAuditEvents(db, q);
  const { getCompanyTimezone } = await import('../attendance/service.js'); // dynamic: attendance imports this module
  const { zonedToUtc, addDays } = await import('../attendance/time.js');
  const tz = (await getCompanyTimezone(db)) ?? '';
  const zone = tz && isValidTimeZone(tz) ? tz : 'UTC';
  return listAuditEvents(db, {
    ...q,
    from: dateOnly(q.from) ? zonedToUtc(q.from as string, '00:00', zone).toISOString() : q.from,
    to: dateOnly(q.to) ? zonedToUtc(addDays(q.to as string, 1), '00:00', zone).toISOString() : q.to,
  });
}
