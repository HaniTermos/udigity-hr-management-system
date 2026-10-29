import type { BusinessDetail, BusinessInput, DuplicateMatch } from '@/lib/api/businesses';
import { digitsOnly } from './format';

/**
 * Form model for SCR-DE-002 (create) and SCR-DE-004 (edit). The screens validate every field at once (summary at
 * the top plus inline messages, S4 note N4). "Unknown" disables the value and is stored as null, never 0.
 */

/**
 * Country codes offered in the phone picker. D11 (approved): no assumed country code — a new phone row starts
 * with NO code and the user must choose one explicitly (the `+000` placeholder default is gone). A company
 * default country code applies on the server only once the Owner has set it.
 */
export const COUNTRY_CODES = ['+961'] as const;

/** E.164 country calling code: `+`, first digit 1–9, at most 4 digits (mirrors the server rule). */
export const COUNTRY_CODE_PATTERN = /^\+[1-9]\d{0,3}$/;
export const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'LinkedIn', 'X', 'Other'] as const;
export const NOTES_MAX = 2000;

export interface PhoneFormRow {
  key: string;
  countryCode: string;
  number: string;
}

export interface SocialFormRow {
  key: string;
  platform: string;
  handle: string;
  followers: string;
  followersUnknown: boolean;
  lastPost: string;
  lastPostUnknown: boolean;
}

export interface BusinessFormValues {
  name: string;
  /** Branch or location (DEC-013 NM-B). Optional. */
  branch: string;
  /** Category id. */
  category: string;
  phones: PhoneFormRow[];
  hasWebsite: boolean;
  website: string;
  notes: string;
  social: SocialFormRow[];
}

export interface SocialFieldErrors {
  platform?: string;
  handle?: string;
  followers?: string;
  lastPost?: string;
}

export interface BusinessFormErrors {
  name?: string;
  branch?: string;
  category?: string;
  website?: string;
  notes?: string;
  /** Keyed by `PhoneFormRow.key`. */
  phones: Record<string, string>;
  /** Keyed by `SocialFormRow.key`. */
  social: Record<string, SocialFieldErrors>;
  /** "At least one social account is required." */
  socialList?: string;
}

export interface ErrorSummaryItem {
  /** DOM id of the field the summary link moves focus to. */
  fieldId: string;
  message: string;
}

let rowSeq = 0;
export const newRowKey = (): string => `row-${++rowSeq}`;

export const emptyPhone = (): PhoneFormRow => ({ key: newRowKey(), countryCode: '', number: '' });
export const emptySocial = (): SocialFormRow => ({
  key: newRowKey(),
  platform: '',
  handle: '',
  followers: '',
  followersUnknown: false,
  lastPost: '',
  lastPostUnknown: false,
});

export function emptyFormValues(): BusinessFormValues {
  return { name: '', branch: '', category: '', phones: [emptyPhone()], hasWebsite: false, website: '', notes: '', social: [emptySocial()] };
}

export function fromDetail(b: BusinessDetail): BusinessFormValues {
  return {
    name: b.name,
    branch: b.branch ?? '',
    category: b.categoryId,
    phones: b.phones.map((p) => ({ key: newRowKey(), countryCode: p.countryCode, number: p.number })),
    hasWebsite: !!b.website,
    website: b.website ?? '',
    notes: b.notes ?? '',
    social: b.social.map((s) => ({
      key: newRowKey(),
      platform: s.platform,
      handle: s.handle,
      followers: s.followers === null ? '' : String(s.followers),
      followersUnknown: s.followers === null,
      lastPost: s.lastPost ?? '',
      lastPostUnknown: s.lastPost === null,
    })),
  };
}

const stripProtocol = (v: string) => v.trim().replace(/^https?:\/\//i, '');

export function toInput(v: BusinessFormValues): BusinessInput {
  return {
    name: v.name.trim(),
    branch: v.branch.trim() ? v.branch.trim() : null,
    categoryId: v.category,
    phones: v.phones.map((p) => ({ countryCode: p.countryCode, number: p.number.trim() })),
    social: v.social.map((s) => ({
      platform: s.platform,
      handle: s.handle.trim(),
      followers: s.followersUnknown ? null : Number(s.followers.replace(/[\s,]/g, '')),
      lastPost: s.lastPostUnknown ? null : s.lastPost,
    })),
    website: v.hasWebsite ? stripProtocol(v.website) : null,
    notes: v.notes.trim() ? v.notes.trim() : null,
  };
}

/** Stable snapshot used for "Unsaved changes" (row keys are excluded). */
export function snapshot(v: BusinessFormValues): string {
  return JSON.stringify({
    ...v,
    phones: v.phones.map((p) => [p.countryCode, p.number]),
    social: v.social.map((s) => [s.platform, s.handle, s.followers, s.followersUnknown, s.lastPost, s.lastPostUnknown]),
  });
}

const isDateInPast = (iso: string, today: string) => iso <= today;

export function validate(v: BusinessFormValues, today: string = new Date().toISOString().slice(0, 10)): BusinessFormErrors {
  const e: BusinessFormErrors = { phones: {}, social: {} };
  if (!v.name.trim()) e.name = 'Enter the business name.';
  if (v.branch.length > 120) e.branch = 'Branch can be up to 120 characters.';
  if (!v.category) e.category = 'Choose a category.';

  v.phones.forEach((p) => {
    const d = digitsOnly(p.number);
    if (!d) e.phones[p.key] = 'Enter the number, or remove this row.';
    else if (d.length < 6 || d.length > 15) e.phones[p.key] = 'Enter a valid phone number.';
    else if (!p.number.trim().startsWith('+') && !COUNTRY_CODE_PATTERN.test(p.countryCode.trim())) {
      e.phones[p.key] = 'Choose the country code.';
    }
  });

  if (v.hasWebsite) {
    const site = stripProtocol(v.website);
    if (!site) e.website = 'Enter the website address, or untick Has website.';
    else if (/\s/.test(site) || !/^[^\s/]+\.[^\s/]{2,}(\/.*)?$/.test(site)) e.website = 'Enter a valid website address.';
  }

  if (v.notes.length > NOTES_MAX) e.notes = `Notes can be up to ${NOTES_MAX} characters.`;

  if (v.social.length === 0) e.socialList = 'At least one social account is required.';
  v.social.forEach((s) => {
    const se: SocialFieldErrors = {};
    if (!s.platform) se.platform = 'Choose a platform.';
    if (!s.handle.trim()) se.handle = 'Enter the handle or link.';
    if (!s.followersUnknown) {
      const n = s.followers.replace(/[\s,]/g, '');
      if (!n) se.followers = 'Enter followers, or tick Unknown.';
      else if (!/^\d+$/.test(n)) se.followers = 'Use whole numbers only.';
    }
    if (!s.lastPostUnknown) {
      if (!s.lastPost) se.lastPost = 'Enter the date, or tick Unknown.';
      else if (!isDateInPast(s.lastPost, today)) se.lastPost = 'The date cannot be in the future.';
    }
    if (Object.keys(se).length > 0) e.social[s.key] = se;
  });
  return e;
}

export function hasErrors(e: BusinessFormErrors): boolean {
  return !!(e.name || e.branch || e.category || e.website || e.notes || e.socialList || Object.keys(e.phones).length || Object.keys(e.social).length);
}

export const FIELD_IDS = {
  name: 'bf-name',
  branch: 'bf-branch',
  category: 'bf-category',
  website: 'bf-website',
  notes: 'bf-notes',
  phone: (key: string) => `bf-phone-${key}`,
  socialPlatform: (key: string) => `bf-social-${key}-platform`,
  socialHandle: (key: string) => `bf-social-${key}-handle`,
  socialFollowers: (key: string) => `bf-social-${key}-followers`,
  socialLastPost: (key: string) => `bf-social-${key}-lastpost`,
  addSocial: 'bf-add-social',
} as const;

/** Flattens the errors in reading order for the summary at the top (S4 note N4). */
export function summarize(e: BusinessFormErrors, v: BusinessFormValues): ErrorSummaryItem[] {
  const out: ErrorSummaryItem[] = [];
  if (e.name) out.push({ fieldId: FIELD_IDS.name, message: e.name });
  if (e.branch) out.push({ fieldId: FIELD_IDS.branch, message: e.branch });
  if (e.category) out.push({ fieldId: FIELD_IDS.category, message: e.category });
  v.phones.forEach((p, i) => {
    if (e.phones[p.key]) out.push({ fieldId: FIELD_IDS.phone(p.key), message: `Phone ${i + 1}: ${e.phones[p.key]}` });
  });
  if (e.website) out.push({ fieldId: FIELD_IDS.website, message: e.website });
  if (e.socialList) out.push({ fieldId: FIELD_IDS.addSocial, message: e.socialList });
  v.social.forEach((s, i) => {
    const se = e.social[s.key];
    if (!se) return;
    const label = `Social account ${i + 1}`;
    if (se.platform) out.push({ fieldId: FIELD_IDS.socialPlatform(s.key), message: `${label}: ${se.platform}` });
    if (se.handle) out.push({ fieldId: FIELD_IDS.socialHandle(s.key), message: `${label}: ${se.handle}` });
    if (se.followers) out.push({ fieldId: FIELD_IDS.socialFollowers(s.key), message: `${label}: ${se.followers}` });
    if (se.lastPost) out.push({ fieldId: FIELD_IDS.socialLastPost(s.key), message: `${label}: ${se.lastPost}` });
  });
  if (e.notes) out.push({ fieldId: FIELD_IDS.notes, message: e.notes });
  return out;
}

/** Finds the phone row a duplicate match refers to, so the inline error lands on the right field. */
export function phoneKeyForMatch(v: BusinessFormValues, match: DuplicateMatch): string | null {
  if (match.visibility !== 'visible' || match.matchedOn !== 'phone') return null;
  const target = digitsOnly(match.matchedValue);
  return (
    v.phones.find((p) => digitsOnly(p.countryCode + p.number) === target)?.key ??
    v.phones.find((p) => digitsOnly(p.number) !== '' && target.endsWith(digitsOnly(p.number)))?.key ??
    null
  );
}

/** Errors keyed like the server's `VALIDATION_ERROR.details` (`name`, `phones.0.number`, `social.1.lastPost`, …). */
export interface ServerFieldErrors extends Omit<Partial<BusinessFormErrors>, 'phones' | 'social'> {
  phones: Record<string, string>;
  social: Record<string, SocialFieldErrors>;
}

/** Maps `ApiError.details` of a 400 to the form rows. Anything that has no field is returned in `other`. */
export function mapServerErrors(details: unknown, v: BusinessFormValues): { errors: ServerFieldErrors; other: string[] } {
  const errors: ServerFieldErrors = { phones: {}, social: {} };
  const other: string[] = [];
  if (!details || typeof details !== 'object') return { errors, other };
  for (const [path, raw] of Object.entries(details as Record<string, unknown>)) {
    const msg = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
    if (!msg) continue;
    const parts = path.split('.');
    const [head, idx, leaf] = parts;
    if (head === 'name') errors.name = msg;
    else if (head === 'branch') errors.branch = msg;
    else if (head === 'category' || head === 'categoryId') errors.category = msg;
    else if (head === 'website') errors.website = msg;
    else if (head === 'notes') errors.notes = msg;
    else if (head === 'phones' && idx !== undefined && v.phones[Number(idx)]) errors.phones[v.phones[Number(idx)].key] = msg;
    else if (head === 'social' && idx === undefined) errors.socialList = msg;
    else if (head === 'social' && v.social[Number(idx)]) {
      const row = v.social[Number(idx)];
      const field = (leaf as keyof SocialFieldErrors) in ({ platform: 1, handle: 1, followers: 1, lastPost: 1 } as object) ? (leaf as keyof SocialFieldErrors) : 'handle';
      errors.social[row.key] = { ...(errors.social[row.key] ?? {}), [field]: msg };
    } else other.push(msg);
  }
  return { errors, other };
}
