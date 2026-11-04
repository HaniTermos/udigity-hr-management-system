/**
 * MOD-business — service (rules + public operations for other modules). Owner: BE2.
 *
 * Commands run inside `runCommand` (one transaction: change + edit history + audit + outbox). `updateBusiness`
 * is the ONLY master-data edit command; MOD-corrections applies requests through it (OI-19).
 *
 * Pending policies (each a "Demonstration alternative — not approved (docs/policy-defaults.md)"):
 * B2/VR-4 default country code (NEEDS VALUE → 409 POLICY_NOT_CONFIGURED), PH-2 phone optional (no phone =
 * not callable), DEC-013 NM-B + SN-1, DEC-003 (i) existence only, DEC-014/023 Unknown metrics, DEC-015
 * category authority, DEC-024 platforms, C-01 archive only, OI-21 "Other", OI-11 history field limits.
 */
import type { Request } from 'express';
import type { Queryable } from '../../db/pool.js';
import { pool } from '../../db/pool.js';
import { access, type AccessAllowed, type AccessDecision, type Principal } from '../../shared/access.js';
import {
  HttpError,
  hiddenByPolicy,
  notFound,
  permissionDenied,
  policyNotConfigured,
  ruleViolation,
  stateConflict,
  versionConflict,
} from '../../shared/errors.js';
import { outbox } from '../../shared/outbox.js';
import { orderByClause } from '../../shared/pagination.js';
import { SqlParams } from '../../shared/sql.js';
import { audit, runCommand, type CommandContext } from '../../shared/tx.js';
import { getSetting } from '../admin/service.js';
import { hiddenForOthersPredicate, refreshAccessSettings } from '../access/schemas.js';
import { initCallingState } from '../calls/service.js';
import { clock } from '../platform/clock.js';
import {
  collapsePhones,
  nameKey,
  normalizeBranch,
  normalizeHandle,
  normalizeName,
  normalizePhone,
} from '../duplicates/service.js';
import type { DuplicateMatch, SimilarName } from '../duplicates/schemas.js';
import * as repo from './repo.js';
import type {
  BusinessCorrectionSummary,
  BusinessDetail,
  BusinessFlag,
  BusinessListQuery,
  BusinessPage,
  BusinessRow,
  CategoryRow,
  CreateBusinessInput,
  DuplicateCheckInput,
  HistoryEntry,
  SearchHit,
  SearchPage,
  SearchQuery,
  UpdateBusinessInput,
} from './schemas.js';

// ---------------------------------------------------------------------------------------------
// MOD-corrections bridge (dependency inversion: corrections depends on businesses, never the reverse).
// ---------------------------------------------------------------------------------------------

export interface OpenCorrections {
  count: number;
  items: BusinessCorrectionSummary[];
}

export interface CorrectionApplyHandle {
  /** Mark the request Resolved in the same transaction, after the business change was written. */
  finish(note: string | null): Promise<void>;
}

export interface CorrectionsBridge {
  openSummaries(db: Queryable, businessIds: readonly string[], viewer: Principal): Promise<Map<string, OpenCorrections>>;
  /** Lock + validate an In-review request for applying through PATCH (`correctionId`). */
  prepareApply(ctx: CommandContext, principal: Principal, correctionId: string, businessId: string): Promise<CorrectionApplyHandle>;
}

let bridge: CorrectionsBridge | null = null;
export function registerCorrectionsBridge(next: CorrectionsBridge): void {
  bridge = next;
}

// ---------------------------------------------------------------------------------------------
// Settings + test overrides
// ---------------------------------------------------------------------------------------------

interface BusinessSettings {
  defaultCountryCode: string;
  threshold: number;
  platforms: string[];
}

async function businessSettings(db: Queryable): Promise<BusinessSettings> {
  // Sequential: `db` may be a transaction client, which must not run concurrent queries (pg).
  const cc = await getSetting(db, 'business.defaultCountryCode');
  const threshold = await getSetting(db, 'duplicates.nameSimilarityThreshold');
  const platforms = await getSetting(db, 'social.platforms');
  return {
    defaultCountryCode: String(cc ?? ''),
    threshold: Number(threshold),
    platforms: (platforms as string[]).map((p) => p.toLowerCase()),
  };
}

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

type FieldErrors = Record<string, string[]>;

function validationError(details: FieldErrors): HttpError {
  return new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', details);
}

function addError(errors: FieldErrors, key: string, message: string): void {
  (errors[key] ??= []).push(message);
}

/** A blocking duplicate (DR-1..DR-5). `details` is shaped per DEC-003 (i); the internal id is for audit only. */
export class DuplicateBlockedError extends HttpError {
  constructor(
    match: DuplicateMatch,
    readonly matchedBusinessId: string,
    readonly matchedOn: 'name' | 'phone'
  ) {
    super(409, 'DUPLICATE_BLOCKED', 'This business already exists', match);
  }
}

/** A UNIQUE index rejected the write (DR-8 race). Re-detected and shaped outside the aborted transaction. */
class UniqueRace extends Error {
  constructor(
    readonly probe: DuplicateProbe,
    readonly excludeId: string | null
  ) {
    super('duplicate race');
  }
}

/** VERSION_CONFLICT that also writes `business.save_conflicted` (AC-BIZ-007) after the rollback. */
class SaveConflict extends HttpError {
  constructor(
    readonly businessId: string,
    readonly currentVersion: number,
    /** BL-09: the access-checked detail the caller may see now (for the SHR-014 diff). Not audited. */
    current?: BusinessDetail
  ) {
    super(409, 'VERSION_CONFLICT', 'The record was changed by someone else', current ? { currentVersion, current } : { currentVersion });
  }
}

const DUPLICATE_CONSTRAINTS = new Set(['uq_business_phones_normalized', 'uq_businesses_name_key']);

async function guardUnique<T>(probe: DuplicateProbe, excludeId: string | null, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === '23505' && err.constraint && DUPLICATE_CONSTRAINTS.has(err.constraint)) throw new UniqueRace(probe, excludeId);
    throw e;
  }
}

/**
 * `runCommand` for business writes. Turns DR-8 races into a shaped DUPLICATE_BLOCKED and writes the
 * `business.duplicate_blocked` / `business.save_conflicted` audit rows in their own transaction (the
 * blocked save itself is rolled back: nothing is saved).
 */
export async function runBusinessCommand<T>(req: Request, principal: Principal, fn: (ctx: CommandContext) => Promise<T>): Promise<T> {
  try {
    return await runCommand(req, fn);
  } catch (e) {
    let err: unknown = e;
    if (err instanceof UniqueRace) {
      const block = await detectBlock(pool, err.probe, err.excludeId);
      err = block
        ? new DuplicateBlockedError(await shapeMatch(pool, principal, block), block.businessId, block.matchedOn)
        : stateConflict('The save collided with another change; please retry');
    }
    if (err instanceof DuplicateBlockedError) {
      const blocked = err;
      await runCommand(req, (ctx) =>
        audit(ctx, {
          eventName: 'business.duplicate_blocked',
          entityType: 'business',
          entityId: blocked.matchedBusinessId,
          payload: { matchedOn: blocked.matchedOn, revealed: (blocked.details as DuplicateMatch).visibility },
        })
      );
    } else if (err instanceof SaveConflict) {
      const conflict = err;
      await runCommand(req, (ctx) =>
        audit(ctx, { eventName: 'business.save_conflicted', entityType: 'business', entityId: conflict.businessId, payload: { currentVersion: conflict.currentVersion } })
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// Duplicate detection (DR-1..DR-9; DEC-013 NM-B + SN-1; DEC-003 (i))
// ---------------------------------------------------------------------------------------------

export interface DuplicateProbe {
  /** Normalised name + branch, or null to skip the name rule (edit without a name/branch change). */
  name: { normalizedName: string; normalizedBranch: string } | null;
  phones: string[];
}

interface Block {
  businessId: string;
  matchedOn: 'name' | 'phone';
  matchedValue: string;
  /** S-27: the phone matched a number the business no longer lists (kept as history; still blocks). */
  removedPhone?: boolean;
}

async function detectBlock(db: Queryable, probe: DuplicateProbe, excludeId: string | null): Promise<Block | null> {
  const phone = await repo.findPhoneMatch(db, probe.phones, excludeId);
  if (phone) return { businessId: phone.business_id, matchedOn: 'phone', matchedValue: phone.normalized_phone, removedPhone: phone.removed };
  if (probe.name && probe.name.normalizedName) {
    const n = probe.name;
    const hit = await repo.findNameMatch(db, nameKey(n.normalizedName, n.normalizedBranch), n.normalizedName, n.normalizedBranch, excludeId);
    if (hit) return { businessId: hit.id, matchedOn: 'name', matchedValue: n.normalizedName };
  }
  return null;
}

/** DEC-003 (i): the Owner sees the match (C1); others see it only with full read access, else existence only. */
async function shapeMatch(db: Queryable, principal: Principal, block: Block): Promise<DuplicateMatch> {
  const row = await repo.findBusiness(db, block.businessId);
  // Businesses are never hard-deleted (D20): a match found a moment ago still exists.
  if (!row) throw stateConflict('The duplicate check collided with another change; please retry');
  let visible = principal.role === 'owner';
  if (!visible) {
    const d = await access.check(db, principal, 'business.read', { type: 'duplicate_preview', id: block.businessId });
    // S-27: a number removed by an edit is history; for non-Owners it reveals existence only (D10).
    visible = d.allowed && d.level === 'full' && !row.archived_at && !block.removedPhone;
  }
  if (!visible) {
    // D10: exactly these fields — no id, phones, social links, notes or assignee.
    return {
      visibility: 'hidden',
      matchedOn: block.matchedOn,
      name: row.name,
      categoryName: row.category,
      createdAt: iso(row.created_at) as string,
    };
  }
  return {
    visibility: 'visible',
    id: row.id,
    name: row.name,
    branch: row.branch,
    matchedOn: block.matchedOn,
    matchedValue: block.matchedValue,
    phones: row.phones.map((p) => p.normalized),
    matchedRemovedPhone: Boolean(block.removedPhone),
    archived: Boolean(row.archived_at),
  };
}

/** SN-1 warning rows the caller may read (never a hint of hidden or archived ones for non-Owners). */
async function similarFor(db: Queryable, principal: Principal, normalizedName: string, threshold: number, excludeId: string | null): Promise<SimilarName[]> {
  if (!normalizedName) return [];
  const candidates = await repo.findSimilarNames(db, normalizedName, threshold, excludeId);
  if (candidates.length === 0) return [];
  let readable = candidates;
  if (principal.role !== 'owner') {
    const decisions = await access.checkMany(
      db,
      principal,
      'business.read',
      candidates.map((c) => ({ type: 'business' as const, id: c.id }))
    );
    readable = candidates.filter((c) => {
      const d = decisions.get(c.id);
      return d?.allowed && d.level === 'full' && !c.archived;
    });
  }
  return readable.slice(0, 5).map((c) => ({ id: c.id, name: c.name, branch: c.branch, similarity: c.similarity }));
}

/** `POST /api/businesses/duplicate-check` (SCR-DE-002/004 live check). Read-only; no audit. */
export async function duplicateCheck(
  db: Queryable,
  principal: Principal,
  input: DuplicateCheckInput
): Promise<{ blocked: boolean; match: DuplicateMatch | null; similar: SimilarName[] }> {
  const settings = await businessSettings(db);
  const normalized: string[] = [];
  const errors: FieldErrors = {};
  input.phones.forEach((p, i) => {
    const r = normalizePhone(p.countryCode, p.number, settings.defaultCountryCode);
    if (r.ok) normalized.push(r.phone.normalized);
    else if (r.reason === 'invalid') addError(errors, `phones.${i}.number`, 'Enter a valid phone number');
  });
  if (Object.keys(errors).length) throw validationError(errors);
  const n = input.name ? normalizeName(input.name) : '';
  const probe: DuplicateProbe = { name: n ? { normalizedName: n, normalizedBranch: normalizeBranch(input.branch ?? '') } : null, phones: normalized };
  const exclude = input.excludeBusinessId ?? null;
  const block = await detectBlock(db, probe, exclude);
  if (block) return { blocked: true, match: await shapeMatch(db, principal, block), similar: [] };
  return { blocked: false, match: null, similar: await similarFor(db, principal, n, settings.threshold, exclude) };
}

/** The probe of a duplicate check / review request, normalised (invalid phones → 400). */
async function probeFrom(db: Queryable, input: { name?: string; branch?: string | null; phones: { countryCode: string; number: string }[] }): Promise<DuplicateProbe> {
  const settings = await businessSettings(db);
  const normalized: string[] = [];
  const errors: FieldErrors = {};
  input.phones.forEach((p, i) => {
    const r = normalizePhone(p.countryCode, p.number, settings.defaultCountryCode);
    if (r.ok) normalized.push(r.phone.normalized);
    else addError(errors, `phones.${i}.number`, r.reason === 'invalid' ? 'Enter a valid phone number' : 'Enter the country code');
  });
  if (Object.keys(errors).length) throw validationError(errors);
  const n = input.name ? normalizeName(input.name) : '';
  return { name: n ? { normalizedName: n, normalizedBranch: normalizeBranch(input.branch ?? '') } : null, phones: normalized };
}

/** Audit + outbox name of a D10 "Request Owner review" (placeholder name; G2). */
export const DUPLICATE_REVIEW_EVENT = 'business.duplicate_review_requested';

/**
 * `POST /api/businesses/duplicate-review-requests` — D10 "Request Owner review" from the duplicate warning.
 * The server re-derives the match from the submitted details (client ids are never accepted), audits the
 * request with the optional explanation and queues an in-app notice to the active Owners (outbox). It grants
 * NO access: the response carries only the same hidden-match disclosure the warning already showed.
 */
export async function requestDuplicateReview(
  ctx: CommandContext,
  principal: Principal,
  input: { name?: string; branch?: string | null; phones: { countryCode: string; number: string }[]; explanation?: string }
): Promise<{ requested: true; match: DuplicateMatch }> {
  const db = ctx.tx;
  const probe = await probeFrom(db, input);
  if (!probe.name && probe.phones.length === 0) throw validationError({ name: ['Enter the business name or a phone number'] });
  const block = await detectBlock(db, probe, null);
  if (!block) throw ruleViolation('No existing business matches these details', { reason: 'NO_DUPLICATE' });
  const match = await shapeMatch(db, principal, block);
  const explanation = input.explanation?.trim() || null;
  await audit(ctx, {
    eventName: DUPLICATE_REVIEW_EVENT,
    entityType: 'business',
    entityId: block.businessId,
    reason: explanation,
    payload: { matchedOn: block.matchedOn, revealed: match.visibility },
  });
  await outbox.emit(db, {
    name: DUPLICATE_REVIEW_EVENT,
    aggregateType: 'business',
    aggregateId: block.businessId,
    payload: { requestedBy: actorId(ctx), matchedOn: block.matchedOn },
  });
  return { requested: true, match };
}

// ---------------------------------------------------------------------------------------------
// Input preparation (VR-1..VR-11)
// ---------------------------------------------------------------------------------------------

const WEBSITE = /^(https?:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:\d{1,5})?(\/[^\s]*)?$/i;

interface PreparedFields {
  phones?: repo.PhoneValues[];
  phonesCollapsed?: boolean;
  social?: repo.SocialValues[];
}

function preparePhones(
  input: { countryCode: string; number: string }[],
  settings: BusinessSettings,
  errors: FieldErrors
): { phones: repo.PhoneValues[]; collapsed: boolean } {
  const out: repo.PhoneValues[] = [];
  let needsCountryCode = false;
  input.forEach((p, i) => {
    const r = normalizePhone(p.countryCode, p.number, settings.defaultCountryCode);
    if (r.ok) out.push({ countryCode: r.phone.countryCode, number: r.phone.number, normalized: r.phone.normalized });
    else if (r.reason === 'no_country_code') needsCountryCode = true;
    else addError(errors, `phones.${i}.number`, 'Enter a valid phone number');
  });
  if (needsCountryCode && Object.keys(errors).length === 0) throw policyNotConfigured('business.defaultCountryCode');
  const { phones, collapsed } = collapsePhones(out);
  return { phones, collapsed };
}

function prepareSocials(
  input: { platform: string; handle: string; followers: number | null; lastPost: string | null }[],
  settings: BusinessSettings,
  errors: FieldErrors
): repo.SocialValues[] {
  const today = clock.now().toISOString().slice(0, 10);
  // One day of slack: the company timezone may be ahead of UTC.
  const latest = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return input.map((s, i) => {
    const platform = s.platform.toLowerCase();
    if (!settings.platforms.includes(platform)) addError(errors, `social.${i}.platform`, 'Choose a listed platform');
    if (s.lastPost !== null) {
      const t = Date.parse(`${s.lastPost}T00:00:00Z`);
      if (Number.isNaN(t)) addError(errors, `social.${i}.lastPost`, 'Use a valid date');
      else if (s.lastPost > latest) addError(errors, `social.${i}.lastPost`, 'The last post date cannot be in the future');
    }
    const normalizedHandle = normalizeHandle(s.handle);
    if (!normalizedHandle) addError(errors, `social.${i}.handle`, 'Enter a handle or link');
    return { platform, handle: s.handle, normalizedHandle, followers: s.followers, lastPost: s.lastPost };
  });
}

async function resolveCategory(
  db: Queryable,
  input: { categoryId?: string; category?: string },
  currentCategoryId: string | null,
  errors: FieldErrors
): Promise<string | null> {
  let row: repo.CategoryDbRow | null = null;
  if (input.categoryId) row = await repo.findCategory(db, input.categoryId);
  else if (input.category) row = await repo.findCategoryByNormalizedName(db, normalizeName(input.category));
  else return currentCategoryId;
  if (!row) {
    addError(errors, 'category', 'Choose a category');
    return null;
  }
  if (!row.is_active && row.id !== currentCategoryId) {
    addError(errors, 'category', 'This category is no longer available');
    return null;
  }
  return row.id;
}

function validateWebsite(website: string | null | undefined, errors: FieldErrors): void {
  if (website === null || website === undefined) return;
  if (!website || !WEBSITE.test(website)) addError(errors, 'website', 'Enter a valid website address');
}

// ---------------------------------------------------------------------------------------------
// DTO mapping
// ---------------------------------------------------------------------------------------------

const iso = (d: Date | string | null): string | null => (d === null ? null : new Date(d).toISOString());

function toRow(r: repo.BusinessDbRow, viewer: Principal, open: OpenCorrections | undefined): BusinessRow {
  const isOwner = viewer.role === 'owner';
  const archived = Boolean(r.archived_at);
  const flags: BusinessFlag[] = [];
  if (r.has_open_correction) flags.push('correction_requested');
  if (r.phones.length === 0) flags.push('no_phone');
  if (isOwner && r.hidden_for_others) flags.push('hidden_from_others');
  if (isOwner && archived) flags.push('archived');
  return {
    id: r.id,
    name: r.name,
    branch: r.branch,
    category: r.category,
    categoryId: r.category_id,
    categoryActive: r.category_active,
    phones: r.phones.map((p) => ({ id: p.id, countryCode: p.countryCode, number: p.number, normalized: p.normalized })),
    social: r.social.map((s) => ({
      id: s.id,
      platform: s.platform,
      handle: s.handle,
      followers: s.followers,
      lastPost: s.lastPost,
      metricsRecordedAt: iso(s.metricsRecordedAt),
      followersObservedAt: iso(s.followersObservedAt),
      lastPostObservedAt: iso(s.lastPostObservedAt),
    })),
    website: r.website,
    createdBy: r.created_by_name ?? '',
    createdById: r.created_by,
    createdAt: iso(r.created_at) as string,
    updatedAt: iso(r.updated_at) as string,
    archived,
    callable: r.phones.length > 0 && !archived,
    flags,
    openCorrections: open?.count ?? 0,
    version: r.version,
  };
}

/** Fields a Developer with context-limited access never receives (matrix §3.4: relevant phones and notes only). */
const DEVELOPER_CTX_REDACTED = ['social', 'website'] as const;

function redactedFieldsFor(principal: Principal, decision: AccessAllowed): string[] {
  return principal.role === 'developer' && decision.level === 'context_limited' ? [...DEVELOPER_CTX_REDACTED] : [];
}

async function openFor(db: Queryable, ids: string[], viewer: Principal): Promise<Map<string, OpenCorrections>> {
  if (!bridge || ids.length === 0) return new Map();
  return bridge.openSummaries(db, ids, viewer);
}

async function buildDetail(db: Queryable, principal: Principal, id: string, decision: AccessAllowed, extra: Partial<BusinessDetail> = {}): Promise<BusinessDetail> {
  const params = new SqlParams();
  const cols = principal.role === 'owner' ? [`${hiddenForOthersPredicate('b', params)} AS hidden_for_others`] : [];
  const idP = params.add(id);
  const { rows } = await db.query<repo.BusinessDbRow>(`${repo.businessSelect(cols)} WHERE b.id = ${idP}`, params.values);
  const r = rows[0];
  if (!r) throw notFound();
  const open = (await openFor(db, [id], principal)).get(id);
  const row = toRow(r, principal, open);
  const redacted = redactedFieldsFor(principal, decision);
  if (redacted.includes('social')) row.social = [];
  if (redacted.includes('website')) row.website = null;
  return {
    ...row,
    notes: r.notes,
    updatedBy: r.updated_by_name,
    access: decision.level,
    exceptionRow: decision.exceptionRow ?? null,
    redactedFields: redacted,
    corrections: open?.items ?? [],
    calling: null,
    dealContext: null,
    ...extra,
  };
}

// ---------------------------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------------------------

/**
 * Access for one business (steps 5–8 by the engine; step 9 archived here). Non-Owners never read an
 * archived business (security review R10): it answers 404 for them.
 */
export async function checkBusiness(db: Queryable, principal: Principal, action: Parameters<typeof access.check>[2], id: string): Promise<AccessDecision> {
  const d = await access.check(db, principal, action, { type: 'business', id });
  if (!d.allowed || principal.role === 'owner') return d;
  const v = await repo.businessVersion(db, id);
  if (!v) return { allowed: false, reason: 'not_found' };
  if (v.archived) return { allowed: false, reason: 'not_found' };
  return d;
}

export async function getBusinessDetail(db: Queryable, principal: Principal, id: string, decision: AccessAllowed): Promise<BusinessDetail> {
  return buildDetail(db, principal, id, decision);
}

const LIST_SORT: Record<string, string> = {
  name: 'lower(b.name)',
  createdAt: 'b.created_at',
  updatedAt: 'b.updated_at',
  category: 'lower(c.name)',
};

function looseTerm(q: string): { name: string | null; digits: string | null; handle: string | null } {
  const name = normalizeName(q) || null;
  const d = q.replace(/\D+/g, '');
  const digits = d.length >= 3 ? d : null;
  const handle = normalizeHandle(q) || null;
  return { name, digits, handle };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listBusinesses(db: Queryable, principal: Principal, q: BusinessListQuery): Promise<BusinessPage> {
  await refreshAccessSettings(db);
  const p = new SqlParams();
  const where: string[] = [access.scopeFilter(principal, 'business.list', 'business', { alias: 'b', params: p })];
  const isOwner = principal.role === 'owner';
  if (!isOwner || q.archived === 'exclude') where.push('b.archived_at IS NULL');
  else if (q.archived === 'only') where.push('b.archived_at IS NOT NULL');
  if (q.q) {
    const t = looseTerm(q.q);
    const parts: string[] = [];
    if (t.name) parts.push(`b.normalized_name LIKE ${p.add(`%${repo.escapeLike(t.name)}%`)} ESCAPE '\\'`);
    if (t.digits) parts.push(`EXISTS (SELECT 1 FROM business_phones lp WHERE lp.business_id = b.id AND lp.normalized_phone LIKE ${p.add(`%${t.digits}%`)})`);
    if (t.handle) parts.push(`EXISTS (SELECT 1 FROM social_accounts ls WHERE ls.business_id = b.id AND ls.normalized_handle LIKE ${p.add(`%${repo.escapeLike(t.handle)}%`)} ESCAPE '\\')`);
    where.push(parts.length ? `(${parts.join(' OR ')})` : 'FALSE');
  }
  if (q.category) {
    where.push(UUID.test(q.category) ? `b.category_id = ${p.add(q.category)}::uuid` : `c.normalized_name = ${p.add(normalizeName(q.category))}`);
  }
  if (q.createdBy) {
    where.push(UUID.test(q.createdBy) ? `b.created_by = ${p.add(q.createdBy)}::uuid` : `lower(ce.full_name) = lower(${p.add(q.createdBy)})`);
  }
  if (q.website === 'yes') where.push('b.website IS NOT NULL');
  if (q.website === 'no') where.push('b.website IS NULL');
  const followersUnknown = 'EXISTS (SELECT 1 FROM social_accounts fs WHERE fs.business_id = b.id AND fs.followers IS NULL)';
  if (q.followers === 'known') where.push('NOT ' + followersUnknown);
  if (q.followers === 'unknown') where.push(followersUnknown);
  const flagWhere =
    q.flag === 'correction_requested'
      ? 'EXISTS (SELECT 1 FROM access_facts aff WHERE aff.business_id = b.id AND aff.has_open_correction)'
      : q.flag === 'no_phone'
        ? 'NOT EXISTS (SELECT 1 FROM business_phones fp WHERE fp.business_id = b.id)'
        : q.flag === 'no_website'
          ? 'b.website IS NULL'
          : q.flag === 'followers_unknown'
            ? followersUnknown
            : null;
  const order = `${orderByClause(q, LIST_SORT, 'createdAt')}, b.id ${q.order === 'asc' ? 'ASC' : 'DESC'}`;
  const res = await repo.listBusinessRows(db, {
    where,
    flagWhere,
    orderBy: order,
    params: p,
    page: q.page,
    pageSize: q.pageSize,
    extraCols: (params) => (isOwner ? [`${hiddenForOthersPredicate('b', params)} AS hidden_for_others`] : []),
  });
  const open = await openFor(db, res.rows.map((r) => r.id), principal);
  return {
    items: res.rows.map((r) => toRow(r, principal, open.get(r.id))),
    page: q.page,
    pageSize: q.pageSize,
    total: res.total,
    counts: { correctionRequested: res.correctionRequested },
    facets: { categories: res.categories, creators: res.creators },
  };
}

/** SHR-010 scoped search. Hidden and context-limited rows are never returned or counted (Table RT rule 4). */
export async function searchBusinesses(db: Queryable, principal: Principal, q: SearchQuery): Promise<SearchPage> {
  await refreshAccessSettings(db);
  const p = new SqlParams();
  const scopeParts = [access.scopeFilter(principal, 'business.search', 'business', { alias: 'b', params: p })];
  if (principal.role !== 'owner') scopeParts.push('b.archived_at IS NULL');
  const t = looseTerm(q.q);
  const isOwner = principal.role === 'owner';
  const res = await repo.searchBusinessRows(db, {
    scope: scopeParts.join(' AND '),
    params: p,
    name: t.name,
    phoneDigits: t.digits,
    handle: t.handle,
    matchType: q.matchType ?? null,
    page: q.page,
    pageSize: q.pageSize,
    extraCols: (params) => (isOwner ? [`${hiddenForOthersPredicate('b', params)} AS hidden_for_others`] : []),
  });
  const items: SearchHit[] = res.rows.map((r) => {
    const row = toRow(r, principal, undefined);
    const matchedOn: SearchHit['matchedOn'] = [];
    if (r.m_name) matchedOn.push('name');
    if (r.m_phone) matchedOn.push('phone');
    if (r.m_social) matchedOn.push('social');
    return {
      id: row.id,
      name: row.name,
      branch: row.branch,
      category: row.category,
      matchedOn,
      phones: row.phones,
      social: row.social,
      flags: row.flags,
      archived: row.archived,
    };
  });
  const total = q.matchType ? res.counts[q.matchType] : res.counts.all;
  return { items, page: q.page, pageSize: q.pageSize, total, counts: res.counts };
}

/** History (AC-BIZ-008, OI-11): entries limited to the fields the caller may see at its access level. */
export async function getHistory(
  db: Queryable,
  principal: Principal,
  id: string,
  decision: AccessAllowed,
  page: number,
  pageSize: number
): Promise<{ items: HistoryEntry[]; page: number; pageSize: number; total: number }> {
  const exclude = redactedFieldsFor(principal, decision);
  const { rows, total } = await repo.listHistory(db, id, exclude, page, pageSize);
  return {
    items: rows.map((h) => ({
      id: h.id,
      at: iso(h.changed_at) as string,
      kind: h.change_kind,
      field: h.field,
      before: h.change_kind === 'created' && exclude.length ? stripFields(h.before_value, exclude) : h.before_value,
      after: h.change_kind === 'created' && exclude.length ? stripFields(h.after_value, exclude) : h.after_value,
      by: h.changed_by_name,
      byId: h.changed_by,
      correctionId: h.correction_request_id,
    })),
    page,
    pageSize,
    total,
  };
}

function stripFields(value: unknown, fields: readonly string[]): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const f of fields) delete out[f];
  return out;
}

/** Labels for other modules' rows (corrections queue). No access decision: callers check first. */
export function businessLabels(db: Queryable, ids: readonly string[]) {
  return repo.businessLabels(db, ids);
}

/** Ids of businesses whose normalised name contains the term (corrections queue text filter). */
export function businessIdsMatchingName(db: Queryable, term: string): Promise<string[]> {
  const n = normalizeName(term);
  return n ? repo.businessIdsByName(db, n) : Promise.resolve([]);
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

/** Snapshot used for field-level history (AC-BIZ-008). */
function snapshot(r: repo.BusinessDbRow): Record<string, unknown> {
  return {
    name: r.name,
    branch: r.branch,
    category: r.category,
    phones: r.phones.map((p) => p.normalized),
    social: r.social.map((s) => ({ platform: s.platform, handle: s.handle, followers: s.followers, lastPost: s.lastPost })),
    website: r.website,
    notes: r.notes,
  };
}

const HISTORY_FIELDS = ['name', 'branch', 'category', 'phones', 'social', 'website', 'notes'] as const;

function actorId(ctx: CommandContext): string {
  if (ctx.actor.kind !== 'employee') throw new Error('Business commands need an employee actor');
  return ctx.actor.employeeId;
}

export async function createBusiness(ctx: CommandContext, principal: Principal, input: CreateBusinessInput): Promise<BusinessDetail> {
  const db = ctx.tx;
  const settings = await businessSettings(db);
  const errors: FieldErrors = {};
  const categoryId = await resolveCategory(db, input, null, errors);
  const { phones, collapsed } = preparePhones(input.phones, settings, errors);
  const social = prepareSocials(input.social, settings, errors);
  validateWebsite(input.website, errors);
  const normalizedName = normalizeName(input.name);
  if (!normalizedName) addError(errors, 'name', 'Enter the business name');
  if (Object.keys(errors).length || !categoryId) throw validationError(errors);

  const normalizedBranch = normalizeBranch(input.branch ?? '');
  const probe: DuplicateProbe = { name: { normalizedName, normalizedBranch }, phones: phones.map((p) => p.normalized) };
  const block = await detectBlock(db, probe, null);
  if (block) throw new DuplicateBlockedError(await shapeMatch(db, principal, block), block.businessId, block.matchedOn);
  const similar = await similarFor(db, principal, normalizedName, settings.threshold, null);
  if (similar.length && !input.confirmSimilar) {
    throw new HttpError(409, 'CONFLICT_DUPLICATE', 'A business with a similar name exists', { kind: 'similar_name', similar });
  }

  const me = actorId(ctx);
  const id = await guardUnique(probe, null, async () => {
    const newId = await repo.insertBusiness(
      db,
      {
        name: input.name,
        branch: input.branch || null,
        normalizedName,
        normalizedBranch,
        nameKey: nameKey(normalizedName, normalizedBranch),
        categoryId,
        website: input.website || null,
        notes: input.notes || null,
      },
      me
    );
    await repo.replacePhones(db, newId, phones);
    return newId;
  });
  await repo.replaceSocials(db, id, social, ctx.now);
  // C-02: outcome Pending, Unassigned (BE3 owns the row; ORCH-4 d).
  await initCallingState(db, id);

  const created = await repo.findBusiness(db, id);
  if (!created) throw new Error('business vanished inside its own transaction');
  await repo.insertHistory(db, {
    businessId: id,
    kind: 'created',
    field: null,
    before: null,
    after: snapshot(created),
    actorId: me,
    correctionId: null,
    requestId: ctx.requestId,
  });
  await audit(ctx, { eventName: 'business.created', entityType: 'business', entityId: id, after: { name: created.name, categoryId } });
  if (similar.length) {
    await audit(ctx, {
      eventName: 'business.similar_name_confirmed',
      entityType: 'business',
      entityId: id,
      payload: { similarIds: similar.map((s) => s.id).join(',') },
    });
  }
  const level = principal.role === 'owner' ? 'owner' : 'full';
  return buildDetail(db, principal, id, { allowed: true, level }, collapsed ? { phonesCollapsed: true } : {});
}

export interface UpdateOptions {
  /** Set by MOD-corrections when the change applies an In-review request (resolve endpoint). */
  viaCorrectionId?: string | null;
}

/**
 * The single master-data edit command (plan §1). Access: Owner; Data Entry with full access, or with the
 * row-6 context grant only while applying a correction request. Step 9: archived → 409 STATE_CONFLICT.
 */
export async function updateBusiness(
  ctx: CommandContext,
  principal: Principal,
  id: string,
  input: Omit<UpdateBusinessInput, 'correctionId' | 'correctionNote'> & { correctionId?: string; correctionNote?: string },
  options: UpdateOptions = {}
): Promise<BusinessDetail> {
  const db = ctx.tx;
  const decision = await checkBusiness(db, principal, 'business.update', id);
  if (!decision.allowed) {
    if (decision.reason === 'not_found') throw notFound();
    if (decision.reason === 'hidden_by_policy') throw hiddenByPolicy();
    throw permissionDenied();
  }
  const applyingCorrection = Boolean(options.viaCorrectionId || input.correctionId);
  if (decision.level === 'context_limited' && !(principal.role === 'data_entry' && decision.exceptionRow === 'R6_OPEN_CORRECTION' && applyingCorrection)) {
    throw hiddenByPolicy();
  }

  const before = await repo.findBusiness(db, id, true);
  if (!before) throw notFound();
  if (before.archived_at) throw stateConflict('Archived businesses cannot be edited', { reason: 'ARCHIVED' });
  if (before.version !== input.version) throw new SaveConflict(id, before.version, await buildDetail(db, principal, id, decision));

  const handle = input.correctionId && bridge ? await bridge.prepareApply(ctx, principal, input.correctionId, id) : null;
  if (input.correctionId && !bridge) throw stateConflict('Corrections are not available');

  const settings = await businessSettings(db);
  const errors: FieldErrors = {};
  const categoryId = await resolveCategory(db, input, before.category_id, errors);
  const prepared: PreparedFields = {};
  if (input.phones) {
    const r = preparePhones(input.phones, settings, errors);
    prepared.phones = r.phones;
    prepared.phonesCollapsed = r.collapsed;
  }
  if (input.social) prepared.social = prepareSocials(input.social, settings, errors);
  if (input.website !== undefined) validateWebsite(input.website, errors);
  const name = input.name ?? before.name;
  const normalizedName = normalizeName(name);
  if (!normalizedName) addError(errors, 'name', 'Enter the business name');
  if (Object.keys(errors).length || !categoryId) throw validationError(errors);

  const branch = input.branch !== undefined ? input.branch || null : before.branch;
  const normalizedBranch = normalizeBranch(branch ?? '');
  const nameChanged = normalizedName !== before.normalized_name || normalizedBranch !== before.normalized_branch;
  const probe: DuplicateProbe = {
    name: nameChanged ? { normalizedName, normalizedBranch } : null,
    phones: (prepared.phones ?? []).map((p) => p.normalized),
  };
  const block = await detectBlock(db, probe, id);
  if (block) throw new DuplicateBlockedError(await shapeMatch(db, principal, block), block.businessId, block.matchedOn);
  let similar: SimilarName[] = [];
  if (nameChanged && normalizedName !== before.normalized_name) {
    similar = await similarFor(db, principal, normalizedName, settings.threshold, id);
    if (similar.length && !input.confirmSimilar) {
      throw new HttpError(409, 'CONFLICT_DUPLICATE', 'A business with a similar name exists', { kind: 'similar_name', similar });
    }
  }

  const me = actorId(ctx);
  await guardUnique(probe, id, async () => {
    const next = await repo.updateBusinessCore(
      db,
      id,
      input.version,
      {
        name,
        branch,
        normalizedName,
        normalizedBranch,
        nameKey: nameKey(normalizedName, normalizedBranch),
        categoryId,
        website: input.website !== undefined ? input.website || null : before.website,
        notes: input.notes !== undefined ? input.notes || null : before.notes,
      },
      me
    );
    if (next === null) throw versionConflict(before.version);
    if (prepared.phones) await repo.replacePhones(db, id, prepared.phones);
  });
  if (prepared.social) await repo.replaceSocials(db, id, prepared.social, ctx.now);

  const after = await repo.findBusiness(db, id);
  if (!after) throw notFound();
  const b = snapshot(before);
  const a = snapshot(after);
  const changed = HISTORY_FIELDS.filter((f) => JSON.stringify(b[f]) !== JSON.stringify(a[f]));
  const correctionId = options.viaCorrectionId ?? input.correctionId ?? null;
  for (const f of changed) {
    await repo.insertHistory(db, {
      businessId: id,
      kind: 'updated',
      field: f,
      before: b[f],
      after: a[f],
      actorId: me,
      correctionId,
      requestId: ctx.requestId,
    });
  }
  await audit(ctx, {
    eventName: 'business.updated',
    entityType: 'business',
    entityId: id,
    payload: { fields: changed.join(','), version: after.version, ...(correctionId ? { correctionId } : {}) },
  });
  if (similar.length) {
    await audit(ctx, { eventName: 'business.similar_name_confirmed', entityType: 'business', entityId: id, payload: { similarIds: similar.map((s) => s.id).join(',') } });
  }
  if (handle) await handle.finish(input.correctionNote ?? null);
  return buildDetail(db, principal, id, decision, prepared.phonesCollapsed ? { phonesCollapsed: true } : {});
}

/** C-01 archive / restore (Owner + 2FA). Repeating the current state is a no-op 200 (SEQ-03). */
export async function setBusinessArchived(
  ctx: CommandContext,
  principal: Principal,
  id: string,
  version: number,
  archive: boolean,
  reason: string | null,
  /** Restore only: an active category replacing a deactivated one (Owner decision 2026-10-29). */
  newCategoryId: string | null = null
): Promise<BusinessDetail> {
  const db = ctx.tx;
  const decision = await checkBusiness(db, principal, archive ? 'business.archive' : 'business.restore', id);
  if (!decision.allowed) throw decision.reason === 'not_found' ? notFound() : permissionDenied();
  const row = await repo.findBusiness(db, id, true);
  if (!row) throw notFound();
  if (Boolean(row.archived_at) === archive) return buildDetail(db, principal, id, decision);
  if (row.version !== version) throw new SaveConflict(id, row.version, await buildDetail(db, principal, id, decision));
  const me = actorId(ctx);
  if (!archive) {
    // D20 (approved): restoring is subject to validation and duplicate checks. The category must still be
    // active, and the restored name/phones must not collide with another record (archived ones included).
    // Owner decision 2026-10-29 "Pick a new category": an inactive category may be replaced by an ACTIVE one in
    // the same transaction (history + audit, reason "category inactive at restore"); without one → 422.
    if (!row.category_active) {
      if (!newCategoryId) {
        throw ruleViolation('This business’s category was deactivated. Choose an active category to restore it.', { reason: 'CATEGORY_INACTIVE' });
      }
      const cat = await repo.findCategory(db, newCategoryId);
      if (!cat || !cat.is_active) throw validationError({ categoryId: ['Choose an active category'] });
      await repo.setCategoryForRestore(db, id, cat.id, me);
      const restoreReason = 'category inactive at restore';
      await repo.insertHistory(db, {
        businessId: id,
        kind: 'updated',
        field: 'category',
        before: row.category,
        after: cat.name,
        actorId: me,
        correctionId: null,
        requestId: ctx.requestId,
      });
      await audit(ctx, {
        eventName: 'business.updated',
        entityType: 'business',
        entityId: id,
        before: { categoryId: row.category_id },
        after: { categoryId: cat.id },
        reason: restoreReason,
        payload: { fields: 'category' },
      });
    } else if (newCategoryId && newCategoryId !== row.category_id) {
      throw validationError({ categoryId: ['The category is active; change it by editing the business after restoring'] });
    }
    const probe: DuplicateProbe = {
      name: row.normalized_name ? { normalizedName: row.normalized_name, normalizedBranch: row.normalized_branch } : null,
      phones: row.phones.map((p) => p.normalized),
    };
    const block = await detectBlock(db, probe, id);
    if (block) throw new DuplicateBlockedError(await shapeMatch(db, principal, block), block.businessId, block.matchedOn);
  }
  // S-31 (Owner 2026-11-04, reverting review fix C-20): archiving is allowed with an open deal or a live
  // contact reservation. D20 keeps every relationship: the deal, the reservation, assignments, follow-ups,
  // meetings and history stay exactly as they are and come back on restore (access denies them while archived).
  const next = await repo.setArchived(db, id, version, archive, me);
  if (next === null) throw versionConflict(row.version);
  await repo.insertHistory(db, {
    businessId: id,
    kind: archive ? 'archived' : 'restored',
    field: null,
    before: { archived: !archive },
    after: { archived: archive },
    actorId: me,
    correctionId: null,
    requestId: ctx.requestId,
  });
  await audit(ctx, { eventName: archive ? 'business.archived' : 'business.restored', entityType: 'business', entityId: id, reason });
  return buildDetail(db, principal, id, decision);
}

// ---------------------------------------------------------------------------------------------
// Categories (WF-BIZ-003)
// ---------------------------------------------------------------------------------------------

function categoryDto(r: repo.CategoryDbRow): CategoryRow {
  return {
    id: r.id,
    name: r.name,
    businessCount: r.business_count,
    active: r.is_active,
    system: r.is_system,
    lastChangedBy: r.updated_by_name,
    lastChangedAt: iso(r.updated_at) as string,
    version: r.version,
  };
}

export async function listCategories(
  db: Queryable,
  principal: Principal,
  page: number,
  pageSize: number
): Promise<{ items: CategoryRow[]; page: number; pageSize: number; total: number }> {
  await refreshAccessSettings(db);
  const params = new SqlParams();
  const isOwner = principal.role === 'owner';
  const countScope = isOwner
    ? 'TRUE'
    : `${access.scopeFilter(principal, 'business.list', 'business', { alias: 'b', params })} AND b.archived_at IS NULL`;
  const { rows, total } = await repo.listCategories(db, { activeOnly: !isOwner, countScope, params, page, pageSize });
  return { items: rows.map(categoryDto), page, pageSize, total };
}

async function uniqueCategory<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === '23505' && err.constraint === 'uq_categories_normalized_name') {
      throw new HttpError(409, 'CONFLICT_DUPLICATE', 'A category with this name already exists', { name: ['A category with this name already exists'] });
    }
    throw e;
  }
}

export async function createCategory(ctx: CommandContext, name: string): Promise<CategoryRow> {
  const normalized = normalizeName(name);
  if (!normalized) throw validationError({ name: ['Enter a name'] });
  const id = await uniqueCategory(() => repo.insertCategory(ctx.tx, name, normalized, actorId(ctx)));
  await audit(ctx, { eventName: 'category.created', entityType: 'category', entityId: id, after: { name } });
  const row = await repo.findCategory(ctx.tx, id);
  return categoryDto(row as repo.CategoryDbRow);
}

export async function renameCategory(ctx: CommandContext, id: string, name: string, version: number): Promise<CategoryRow> {
  const row = await repo.findCategory(ctx.tx, id, true);
  if (!row) throw notFound();
  if (row.is_system) throw ruleViolation('The "Other" category cannot be renamed', { reason: 'SYSTEM_CATEGORY' });
  const normalized = normalizeName(name);
  if (!normalized) throw validationError({ name: ['Enter a name'] });
  if (row.name === name) return categoryDto(row);
  if (row.version !== version) throw versionConflict(row.version, categoryDto(row));
  const next = await uniqueCategory(() => repo.renameCategory(ctx.tx, id, version, name, normalized, actorId(ctx)));
  if (next === null) throw versionConflict(row.version);
  await audit(ctx, { eventName: 'category.renamed', entityType: 'category', entityId: id, before: { name: row.name }, after: { name } });
  return categoryDto((await repo.findCategory(ctx.tx, id)) as repo.CategoryDbRow);
}

export async function deactivateCategory(ctx: CommandContext, id: string, version: number): Promise<CategoryRow> {
  const row = await repo.findCategory(ctx.tx, id, true);
  if (!row) throw notFound();
  if (row.is_system) throw ruleViolation('The "Other" category cannot be deactivated', { reason: 'SYSTEM_CATEGORY' });
  if (!row.is_active) return categoryDto(row);
  if (row.version !== version) throw versionConflict(row.version, categoryDto(row));
  const next = await repo.deactivateCategory(ctx.tx, id, version, actorId(ctx));
  if (next === null) throw versionConflict(row.version);
  await audit(ctx, { eventName: 'category.deactivated', entityType: 'category', entityId: id, before: { active: true }, after: { active: false } });
  return categoryDto((await repo.findCategory(ctx.tx, id)) as repo.CategoryDbRow);
}
