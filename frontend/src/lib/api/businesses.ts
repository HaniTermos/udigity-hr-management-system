/**
 * businesses API — backend MOD-business + MOD-duplicates (BE2). Owner: FE3.
 * Screens: SCR-DE-001..004, SCR-DE-007, SCR-SHR-008, SCR-SHR-010.
 * Source of truth: backend `modules/{businesses,duplicates}/schemas.ts`, posted as [BE2-C2] on the board.
 * No fixtures: BE2 has shipped these endpoints.
 */
import { api, ApiError, newIdempotencyKey } from './client';
import type { AccessLevel, IsoDate, IsoDateTime, Page, PageQuery } from './types';

export const businessesPaths = {
  list: '/api/businesses',
  create: '/api/businesses',
  detail: (id: string) => `/api/businesses/${id}`,
  history: (id: string) => `/api/businesses/${id}/history`,
  archive: (id: string) => `/api/businesses/${id}/archive`,
  restore: (id: string) => `/api/businesses/${id}/restore`,
  duplicateCheck: '/api/businesses/duplicate-check',
  categories: '/api/categories',
  category: (id: string) => `/api/categories/${id}`,
  categoryDeactivate: (id: string) => `/api/categories/${id}/deactivate`,
  search: '/api/search',
} as const;

/* ---------------- shared shapes ---------------- */

export interface PhoneNumber {
  id: string;
  /** e.g. `+961`. May be empty when the company default country code applies. */
  countryCode: string;
  /** National number as entered. */
  number: string;
  /** E.164-like `+<digits>`, used for matching. */
  normalized: string;
}

export interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  /** `null` = Unknown. Never shown or stored as 0 (DEC-014/023 pending). */
  followers: number | null;
  /** `null` = Unknown. */
  lastPost: IsoDate | null;
  metricsRecordedAt: IsoDateTime | null;
}

/** Flags drawn on the directory/search rows. `hidden_from_others` and `archived` reach the Owner only. */
export type BusinessFlag = 'correction_requested' | 'no_phone' | 'hidden_from_others' | 'archived';

export interface BusinessRow {
  id: string;
  name: string;
  /** Second line under the name, e.g. `Downtown branch`. */
  branch: string | null;
  category: string;
  categoryId: string;
  /** `false` when the business still carries a deactivated category. */
  categoryActive: boolean;
  phones: PhoneNumber[];
  social: SocialAccount[];
  website: string | null;
  createdBy: string;
  createdById: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  archived: boolean;
  /** Has a phone and is not archived (B2). */
  callable: boolean;
  flags: BusinessFlag[];
  openCorrections: number;
  version: number;
}

/* ---------------- directory (SCR-DE-001) ---------------- */

export type DirectoryFlagFilter = 'correction_requested' | 'no_phone' | 'no_website' | 'followers_unknown';
export type ArchivedFilter = 'exclude' | 'include' | 'only';

export interface BusinessQuery extends PageQuery {
  /** Name, phone digits or social handle. */
  q?: string;
  /** Category id or name. */
  category?: string;
  /** Creator id or name. */
  createdBy?: string;
  website?: 'yes' | 'no';
  followers?: 'known' | 'unknown';
  flag?: DirectoryFlagFilter;
  /** `include` and `only` are Owner-only. */
  archived?: ArchivedFilter;
  sort?: 'name' | 'createdAt' | 'updatedAt' | 'category';
}

export interface BusinessPage extends Page<BusinessRow> {
  /** Counted after access filtering. */
  counts: { correctionRequested: number };
  /** Filter options for the selects (visible creators only). */
  facets: { categories: string[]; creators: string[] };
}

export function listBusinesses(q: BusinessQuery = {}): Promise<BusinessPage> {
  return api.get<BusinessPage>(businessesPaths.list, { query: { ...q } });
}

/* ---------------- detail (SCR-SHR-008) ---------------- */

export interface BusinessCorrectionSummary {
  id: string;
  issueType: string;
  status: 'submitted' | 'in_review';
  /** Reviewer name once taken. */
  reviewer: string | null;
  mine: boolean;
  since: IsoDateTime;
}

export interface DealContext {
  dealId: string;
  deal: string;
  stage: string;
  project: string | null;
}

export interface BusinessDetail extends BusinessRow {
  notes: string | null;
  updatedBy: string | null;
  /** `context_limited` for a Developer: social and website are left out and listed in `redactedFields`. */
  access: AccessLevel;
  redactedFields: string[];
  exceptionRow: unknown;
  /** Open requests: all of them for Owner and Data Entry, only your own for Call Center and Developer. */
  corrections: BusinessCorrectionSummary[];
  /** Read ops from BE3 / BE4 arrive later; `null` in v1. */
  calling: string | null;
  dealContext: DealContext | null;
  /** VR-6: duplicates of one phone on this record were collapsed in this save. */
  phonesCollapsed?: boolean;
}

export function getBusiness(id: string): Promise<BusinessDetail> {
  return api.get<BusinessDetail>(businessesPaths.detail(id));
}

export interface BusinessHistoryEntry {
  id: string;
  at: IsoDateTime;
  kind: 'created' | 'updated' | 'archived' | 'restored';
  field: string | null;
  before: unknown;
  after: unknown;
  by: string | null;
  byId: string | null;
  correctionId: string | null;
}

export function getBusinessHistory(id: string, page = 1, pageSize = 25): Promise<Page<BusinessHistoryEntry>> {
  return api.get<Page<BusinessHistoryEntry>>(businessesPaths.history(id), { query: { page, pageSize } });
}

/* ---------------- create / update (SCR-DE-002, SCR-DE-004) ---------------- */

export interface BusinessSocialInput {
  platform: string;
  handle: string;
  followers: number | null;
  lastPost: IsoDate | null;
}

export interface BusinessInput {
  name: string;
  /** Branch / location (DEC-013 NM-B). */
  branch: string | null;
  categoryId: string;
  phones: { countryCode: string; number: string }[];
  social: BusinessSocialInput[];
  /** `null` when "Has website" is off. */
  website: string | null;
  notes: string | null;
}

export interface BusinessCreateInput extends BusinessInput {
  /** DEC-013 SN-1: resend with `true` after the user chose "Different business, continue". */
  confirmSimilar?: boolean;
}

export interface BusinessUpdateInput extends BusinessInput {
  /** Optimistic lock. */
  version: number;
  /** Set when the save applies a correction request, so it resolves in the same transaction (SCR-DE-005). */
  correctionId?: string;
  correctionNote?: string;
  confirmSimilar?: boolean;
}

/**
 * DEC-003 shaping. `visible`: the matching business is one this user can open. `hidden`: existence only,
 * nothing else may be rendered (no id, name, phone or matched field).
 */
export type DuplicateMatch =
  | {
      visibility: 'visible';
      id: string;
      name: string;
      branch: string | null;
      matchedOn: 'name' | 'phone';
      matchedValue: string;
      phones: string[];
      archived: boolean;
    }
  | { visibility: 'hidden' };

/** DEC-013 SN-1: a similar name that this user can read (never lists hidden or archived records). */
export interface SimilarName {
  id: string;
  name: string;
  branch: string | null;
  similarity: number;
}

/** `key` makes a retry of the same save safe; create a new one per user action. */
export function createBusiness(input: BusinessCreateInput, idempotencyKey: string = newIdempotencyKey()): Promise<BusinessDetail> {
  return api.post<BusinessDetail>(businessesPaths.create, input, { idempotencyKey });
}

export function updateBusiness(id: string, input: BusinessUpdateInput): Promise<BusinessDetail> {
  return api.patch<BusinessDetail>(businessesPaths.detail(id), input);
}

/** Owner + 2FA. Repeating the call in the current state is a no-op 200. */
export function archiveBusiness(id: string, version: number, reason?: string): Promise<BusinessDetail> {
  return api.post<BusinessDetail>(businessesPaths.archive(id), { version, ...(reason ? { reason } : {}) });
}

export function restoreBusiness(id: string, version: number): Promise<BusinessDetail> {
  return api.post<BusinessDetail>(businessesPaths.restore(id), { version });
}

export interface DuplicateCheckResult {
  blocked: boolean;
  match: DuplicateMatch | null;
  similar: SimilarName[];
}

export function checkDuplicate(body: {
  name?: string;
  branch?: string | null;
  phones?: { countryCode: string; number: string }[];
  excludeBusinessId?: string;
}): Promise<DuplicateCheckResult> {
  return api.post<DuplicateCheckResult>(businessesPaths.duplicateCheck, body);
}

/** 409 `DUPLICATE_BLOCKED` carries a `DuplicateMatch` in `ApiError.details`. Anything unreadable is shown as hidden. */
export function duplicateMatchFrom(details: unknown): DuplicateMatch {
  const d = details as Partial<DuplicateMatch> | null | undefined;
  return d && d.visibility === 'visible' ? (d as DuplicateMatch) : { visibility: 'hidden' };
}

/** 409 `CONFLICT_DUPLICATE` with `details.kind === 'similar_name'`: the SN-1 warning. Returns `null` for other errors. */
export function similarNamesFrom(err: unknown): SimilarName[] | null {
  if (!(err instanceof ApiError) || err.code !== 'CONFLICT_DUPLICATE') return null;
  const d = err.details as { kind?: string; similar?: SimilarName[] } | null | undefined;
  return d && d.kind === 'similar_name' && Array.isArray(d.similar) ? d.similar : null;
}

/* ---------------- categories (SCR-DE-007) ---------------- */

export interface CategoryRow {
  id: string;
  name: string;
  businessCount: number;
  active: boolean;
  /** "Other" (OI-21): cannot be renamed or deactivated. */
  system: boolean;
  lastChangedBy: string | null;
  lastChangedAt: IsoDateTime;
  version: number;
}

export async function listCategories(): Promise<CategoryRow[]> {
  const res = await api.get<Page<CategoryRow>>(businessesPaths.categories, { query: { pageSize: 100 } });
  return res.items;
}

export function createCategory(name: string): Promise<CategoryRow> {
  return api.post<CategoryRow>(businessesPaths.categories, { name });
}

export function renameCategory(id: string, name: string, version: number): Promise<CategoryRow> {
  return api.patch<CategoryRow>(businessesPaths.category(id), { name, version });
}

/** Deactivate only (CR-1). Deactivating "Other" answers 422 `RULE_VIOLATION`. */
export function deactivateCategory(id: string, version: number): Promise<CategoryRow> {
  return api.post<CategoryRow>(businessesPaths.categoryDeactivate(id), { version });
}

/* ---------------- search (SCR-SHR-010) ---------------- */

export type SearchMatchType = 'name' | 'phone' | 'social';

export interface SearchHit {
  id: string;
  name: string;
  branch: string | null;
  category: string;
  matchedOn: SearchMatchType[];
  phones: PhoneNumber[];
  social: SocialAccount[];
  flags: BusinessFlag[];
  archived: boolean;
}

export interface SearchQuery extends PageQuery {
  /** At least 2 characters. */
  q: string;
  matchType?: SearchMatchType;
}

export interface SearchPage extends Page<SearchHit> {
  /** Counts per match type after access filtering; hidden records are never counted. */
  counts: { all: number; name: number; phone: number; social: number };
}

export function searchBusinesses(q: SearchQuery): Promise<SearchPage> {
  return api.get<SearchPage>(businessesPaths.search, { query: { ...q } });
}
