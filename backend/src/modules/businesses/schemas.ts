/**
 * MOD-business — Zod request schemas (.strict()), response DTOs and VT-3 action declarations. Owner: BE2.
 * Endpoints (plan §4.1): /api/businesses, /api/categories, /api/search. Contract posted as [BE2-C2].
 *
 * Pending policies used here are "Demonstration alternative — not approved (docs/policy-defaults.md)":
 * B2 phone optional (PH-2) + default country code (NEEDS VALUE), DEC-013 NM-B + SN-1, DEC-003 (i),
 * DEC-014/023 Unknown metrics, DEC-015 category authority, C-01 archive only, OI-21 "Other" category.
 */
import { z } from 'zod';
import { defineMatrixActions } from '../access/schemas.js';
import { PageQuerySchema } from '../../shared/pagination.js';
import type { AccessLevel, ExceptionRow } from '../../shared/access.js';

export const BUSINESS_ACTIONS = defineMatrixActions([
  'business.list',
  'business.search',
  'business.read',
  'business.create',
  'business.duplicate_check',
  'business.update',
  'business.archive',
  'business.restore',
  'business.delete',
  'business.history.read',
  'business.read_hidden',
  'category.list',
  'category.create',
  'category.rename',
  'category.deactivate',
] as const);

// ---------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------

const trimmed = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const PhoneInputSchema = z
  .object({
    /** `+961`, `961` or empty (then `business.defaultCountryCode` applies; NEEDS VALUE). */
    countryCode: trimmed(8).default(''),
    number: trimmed(32).min(1, 'Enter a number'),
  })
  .strict();

export const SocialInputSchema = z
  .object({
    /** One of `social.platforms` (DEC-024 SET). */
    platform: trimmed(30).min(1),
    handle: trimmed(255).min(1, 'Enter a handle or link'),
    /** null = Unknown (DEC-014). Never defaulted to 0. */
    followers: z.number().int().min(0).max(2_000_000_000).nullable().default(null),
    /** null = Unknown (DEC-023). Not in the future. */
    lastPost: isoDate.nullable().default(null),
  })
  .strict();

const businessFields = {
  name: trimmed(255).min(1, 'Enter the business name'),
  /** Branch / location (DEC-013 NM-B). Optional. */
  branch: trimmed(120).nullable().optional(),
  /** Category id. Either `categoryId` or `category` (name) is required on create. */
  categoryId: z.string().uuid().optional(),
  category: trimmed(80).min(1).optional(),
  phones: z.array(PhoneInputSchema).max(10),
  social: z.array(SocialInputSchema).min(1, 'Add at least one social account').max(20),
  /** null = "Has website" unticked (VR-11). A value must be an http(s) URL or a bare domain. */
  website: trimmed(2048).nullable(),
  notes: trimmed(4000).nullable().optional(),
};

export const CreateBusinessSchema = z
  .object({
    ...businessFields,
    /** DEC-013 SN-1: true after the user chose "Different business, continue" on the similar-name warning. */
    confirmSimilar: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Boolean(b.categoryId) || Boolean(b.category), { message: 'Choose a category', path: ['category'] });

export const UpdateBusinessSchema = z
  .object({
    version: z.number().int().min(1),
    name: businessFields.name.optional(),
    branch: businessFields.branch,
    categoryId: businessFields.categoryId,
    category: businessFields.category,
    phones: businessFields.phones.optional(),
    social: businessFields.social.optional(),
    website: businessFields.website.optional(),
    notes: businessFields.notes,
    /** Apply this In-review correction request in the same save (SCR-DE-005 → Resolved). */
    correctionId: z.string().uuid().optional(),
    /** Optional resolution note when `correctionId` is set. */
    correctionNote: trimmed(2000).optional(),
    confirmSimilar: z.boolean().optional(),
  })
  .strict();

export const VersionBodySchema = z
  .object({ version: z.number().int().min(1), reason: trimmed(500).optional() })
  .strict();

export const DuplicateCheckSchema = z
  .object({
    name: trimmed(255).optional(),
    branch: trimmed(120).nullable().optional(),
    phones: z.array(PhoneInputSchema).max(10).default([]),
    /** The record being edited (DR-7 self-exclusion). */
    excludeBusinessId: z.string().uuid().optional(),
  })
  .strict();

export const BusinessListQuerySchema = PageQuerySchema.extend({
  q: trimmed(100).optional(),
  /** Category id or name. */
  category: trimmed(80).optional(),
  /** Creator employee id or full name. */
  createdBy: trimmed(120).optional(),
  website: z.enum(['yes', 'no']).optional(),
  followers: z.enum(['known', 'unknown']).optional(),
  flag: z.enum(['correction_requested', 'no_phone', 'no_website', 'followers_unknown']).optional(),
  /** Owner only (C-01). Non-Owners never see archived rows in the directory. */
  archived: z.enum(['exclude', 'include', 'only']).default('exclude'),
}).strict();

export const HistoryQuerySchema = PageQuerySchema.pick({ page: true, pageSize: true }).strict();

export const SearchQuerySchema = PageQuerySchema.extend({
  q: trimmed(100).min(2, 'Enter at least 2 characters'),
  matchType: z.enum(['name', 'phone', 'social']).optional(),
}).strict();

export const CategoryCreateSchema = z.object({ name: trimmed(80).min(1, 'Enter a name') }).strict();
export const CategoryRenameSchema = z.object({ name: trimmed(80).min(1, 'Enter a name'), version: z.number().int().min(1) }).strict();
export const CategoryVersionSchema = z.object({ version: z.number().int().min(1) }).strict();

export type CreateBusinessInput = z.infer<typeof CreateBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof UpdateBusinessSchema>;
export type BusinessListQuery = z.infer<typeof BusinessListQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type DuplicateCheckInput = z.infer<typeof DuplicateCheckSchema>;

// ---------------------------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------------------------

export interface PhoneDto {
  id: string;
  countryCode: string;
  number: string;
  /** E.164-like `+<digits>`. */
  normalized: string;
}

export interface SocialDto {
  id: string;
  platform: string;
  handle: string;
  /** null = Unknown. */
  followers: number | null;
  /** YYYY-MM-DD or null = Unknown. */
  lastPost: string | null;
  metricsRecordedAt: string | null;
}

/** `hidden_from_others` and `archived` reach the Owner only. */
export type BusinessFlag = 'correction_requested' | 'no_phone' | 'hidden_from_others' | 'archived';

export interface BusinessRow {
  id: string;
  name: string;
  branch: string | null;
  category: string;
  categoryId: string;
  categoryActive: boolean;
  phones: PhoneDto[];
  social: SocialDto[];
  website: string | null;
  createdBy: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  /** B2 PH-2: has a phone and is not archived. */
  callable: boolean;
  flags: BusinessFlag[];
  openCorrections: number;
  version: number;
}

export interface BusinessPage {
  items: BusinessRow[];
  page: number;
  pageSize: number;
  total: number;
  counts: { correctionRequested: number };
  facets: { categories: string[]; creators: string[] };
}

export interface BusinessCorrectionSummary {
  id: string;
  issueType: string;
  status: 'submitted' | 'in_review';
  reviewer: string | null;
  mine: boolean;
  since: string;
}

export interface BusinessDetail extends BusinessRow {
  notes: string | null;
  updatedBy: string | null;
  access: AccessLevel;
  exceptionRow: ExceptionRow | null;
  /** Fields left out at this access level (context-limited Developer: social, website). */
  redactedFields: string[];
  /** Open correction requests on this business (warn, never block). */
  corrections: BusinessCorrectionSummary[];
  /** Set by BE3/BE4 read ops in later increments; null until then. */
  calling: null;
  dealContext: null;
  /** VR-6 notice: duplicates of one phone on this record were collapsed in this save. */
  phonesCollapsed?: boolean;
}

export interface HistoryEntry {
  id: string;
  at: string;
  kind: 'created' | 'updated' | 'archived' | 'restored';
  field: string | null;
  before: unknown;
  after: unknown;
  by: string | null;
  byId: string | null;
  correctionId: string | null;
}

export interface CategoryRow {
  id: string;
  name: string;
  businessCount: number;
  active: boolean;
  /** "Other" (OI-21): cannot be deactivated. */
  system: boolean;
  lastChangedBy: string | null;
  lastChangedAt: string;
  version: number;
}

export type SearchMatchType = 'name' | 'phone' | 'social';

export interface SearchHit {
  id: string;
  name: string;
  branch: string | null;
  category: string;
  matchedOn: SearchMatchType[];
  phones: PhoneDto[];
  social: SocialDto[];
  flags: BusinessFlag[];
  archived: boolean;
}

export interface SearchPage {
  items: SearchHit[];
  page: number;
  pageSize: number;
  total: number;
  counts: { all: number; name: number; phone: number; social: number };
}
