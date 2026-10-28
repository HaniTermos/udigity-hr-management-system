/**
 * MOD-duplicates — stateless duplicate rules (AR-02; batch2-spec §2.2 DR-1..DR-9). Owner: BE2.
 * Pure functions only. The atomic re-check (DR-8) is the UNIQUE indexes of migration 201
 * (business_phones.normalized_phone, businesses.name_key); MOD-business runs the lookups.
 *
 * Policies (Demonstration alternative — not approved, docs/policy-defaults.md):
 * - VR-4 / B2: phone normalised to E.164-like `+<digits>` with the default country code
 *   (`business.defaultCountryCode`, NEEDS VALUE) when the input has none.
 * - DEC-013 NM-B: exact normalised name + branch blocks; a different branch does not (code default).
 * - DEC-013 SN-1: trigram similarity >= `duplicates.nameSimilarityThreshold` warns, never blocks.
 * - DEC-003 (i): a match the user may not read reveals existence only.
 */
import type { AccessDecision } from '../../shared/access.js';

export type MatchClass = 'phone_exact' | 'name_branch_exact' | 'name_similar' | 'none';

/** Digits only. */
const digits = (s: string) => s.replace(/\D+/g, '');

export interface NormalizedPhone {
  /** `+` followed by 8–15 digits. */
  normalized: string;
  /** Country calling code with `+`, e.g. `+961`. */
  countryCode: string;
  /** National number as entered (trimmed, single spaces). */
  number: string;
}

export type PhoneResult = { ok: true; phone: NormalizedPhone } | { ok: false; reason: 'invalid' | 'no_country_code' };

/**
 * Normalise one phone (VR-4). `countryCode` may be empty; the number may carry its own `+`/`00` prefix,
 * which wins. A national trunk `0` is dropped. Result must have 8–15 digits in total (E.164 max 15).
 */
export function normalizePhone(countryCode: string | null | undefined, number: string, defaultCountryCode: string): PhoneResult {
  const rawNumber = (number ?? '').trim();
  const display = rawNumber.replace(/\s+/g, ' ');
  if (!rawNumber || /[^\d\s().+-]/.test(rawNumber)) return { ok: false, reason: 'invalid' };
  let cc = digits(countryCode ?? '');
  let national = digits(rawNumber);
  if (rawNumber.startsWith('+') || rawNumber.startsWith('00')) {
    // Fully international number: the prefix wins over the separate country-code field.
    const intl = rawNumber.startsWith('00') ? national.slice(2) : national;
    if (intl.length < 8 || intl.length > 15) return { ok: false, reason: 'invalid' };
    return { ok: true, phone: { normalized: `+${intl}`, countryCode: cc ? `+${cc}` : '', number: display } };
  }
  if (!cc) cc = digits(defaultCountryCode ?? '');
  if (!cc) return { ok: false, reason: 'no_country_code' };
  if (cc.length > 4) return { ok: false, reason: 'invalid' };
  national = national.replace(/^0+/, '');
  const all = cc + national;
  if (national.length < 4 || all.length < 8 || all.length > 15) return { ok: false, reason: 'invalid' };
  return { ok: true, phone: { normalized: `+${all}`, countryCode: `+${cc}`, number: display } };
}

/** Name normalisation (DR-4): Unicode NFKC, lower case, punctuation → space, collapsed spaces. */
export function normalizeName(raw: string): string {
  return (raw ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Branch normalisation: same as the name; empty = no branch. */
export const normalizeBranch = normalizeName;

/** The NM-B uniqueness key stored in `businesses.name_key`. */
export function nameKey(normalizedName: string, normalizedBranch: string): string {
  return `${normalizedName}|${normalizedBranch}`;
}

/** Social handle normalisation for search: lower case, no leading `@`, no URL scheme / trailing slash. */
export function normalizeHandle(raw: string): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
}

/**
 * VR-6: the same normalised phone twice on one record collapses to one. Returns the unique list and
 * whether something collapsed (the UI shows a notice).
 */
export function collapsePhones<T extends { normalized: string }>(phones: T[]): { phones: T[]; collapsed: boolean } {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of phones) {
    if (seen.has(p.normalized)) continue;
    seen.add(p.normalized);
    out.push(p);
  }
  return { phones: out, collapsed: out.length !== phones.length };
}

/** DEC-003 (i) shaping (plan §6.2): readable match → full preview; otherwise existence only. */
export function duplicateRevelation(decision: AccessDecision): 'full' | 'existence_only' {
  return decision.allowed ? 'full' : 'existence_only';
}
