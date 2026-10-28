/**
 * MOD-business — repository (raw parameterised SQL on this module's own tables). Owner: BE2.
 * Owned tables: businesses, business_phones, social_accounts, categories, business_edit_history
 * (+ the match-key UNIQUE indexes of migration 201). Reads `access_facts` (BE2 view) for the open-correction
 * fact and `employees` for display names only. Every function takes a Queryable (pool or ctx.tx).
 */
import type { Queryable } from '../../db/pool.js';
import { SqlParams } from '../../shared/sql.js';

// ---------------------------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------------------------

export interface PhoneJson {
  id: string;
  countryCode: string;
  number: string;
  normalized: string;
}

export interface SocialJson {
  id: string;
  platform: string;
  handle: string;
  followers: number | null;
  lastPost: string | null;
  metricsRecordedAt: string | null;
}

export interface BusinessDbRow {
  id: string;
  name: string;
  branch: string | null;
  normalized_name: string | null;
  normalized_branch: string;
  category_id: string;
  category: string;
  category_active: boolean;
  website: string | null;
  notes: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
  updated_by_name: string | null;
  archived_at: Date | null;
  version: number;
  phones: PhoneJson[];
  social: SocialJson[];
  has_open_correction: boolean | null;
  hidden_for_others?: boolean | null;
}

/** SELECT list + FROM for one business row (DTO source). `extraCols` are trusted SQL fragments. */
export function businessSelect(extraCols: string[] = []): string {
  const extra = extraCols.length ? `, ${extraCols.join(', ')}` : '';
  return `
    SELECT b.id, b.name, b.branch, b.normalized_name, b.normalized_branch, b.category_id,
           c.name AS category, c.is_active AS category_active,
           b.website, b.notes, b.created_by, ce.full_name AS created_by_name, b.created_at, b.updated_at,
           b.updated_by, ue.full_name AS updated_by_name, b.archived_at, b.version,
           COALESCE((SELECT json_agg(json_build_object('id', p.id, 'countryCode', p.country_code, 'number', p.number,
                                                       'normalized', p.normalized_phone) ORDER BY p.position, p.created_at)
                       FROM business_phones p WHERE p.business_id = b.id), '[]'::json) AS phones,
           COALESCE((SELECT json_agg(json_build_object('id', s.id, 'platform', s.platform, 'handle', s.handle,
                                                       'followers', s.followers,
                                                       'lastPost', to_char(s.last_post_date, 'YYYY-MM-DD'),
                                                       'metricsRecordedAt', s.metrics_recorded_at) ORDER BY s.position, s.created_at)
                       FROM social_accounts s WHERE s.business_id = b.id), '[]'::json) AS social,
           (SELECT af.has_open_correction FROM access_facts af WHERE af.business_id = b.id) AS has_open_correction${extra}
      FROM businesses b
      JOIN categories c ON c.id = b.category_id
      LEFT JOIN employees ce ON ce.id = b.created_by
      LEFT JOIN employees ue ON ue.id = b.updated_by`;
}

export async function findBusiness(db: Queryable, id: string, forUpdate = false): Promise<BusinessDbRow | null> {
  const { rows } = await db.query<BusinessDbRow>(
    `${businessSelect()} WHERE b.id = $1 ${forUpdate ? 'FOR UPDATE OF b' : ''}`,
    [id]
  );
  return rows[0] ?? null;
}

export async function businessVersion(db: Queryable, id: string): Promise<{ version: number; archived: boolean } | null> {
  const { rows } = await db.query<{ version: number; archived: boolean }>(
    'SELECT version, archived_at IS NOT NULL AS archived FROM businesses WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function businessLabels(
  db: Queryable,
  ids: readonly string[]
): Promise<Map<string, { id: string; name: string; branch: string | null; category: string; archived: boolean }>> {
  const out = new Map<string, { id: string; name: string; branch: string | null; category: string; archived: boolean }>();
  if (ids.length === 0) return out;
  const { rows } = await db.query<{ id: string; name: string; branch: string | null; category: string; archived: boolean }>(
    `SELECT b.id, b.name, b.branch, c.name AS category, b.archived_at IS NOT NULL AS archived
       FROM businesses b JOIN categories c ON c.id = b.category_id
      WHERE b.id = ANY($1::uuid[])`,
    [ids]
  );
  for (const r of rows) out.set(r.id, r);
  return out;
}

/** Business ids whose name contains `normalizedQ` (used by the correction queue text filter). */
export async function businessIdsByName(db: Queryable, normalizedQ: string, limit = 1000): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM businesses WHERE normalized_name LIKE $1 ESCAPE '\\' LIMIT $2`,
    [`%${escapeLike(normalizedQ)}%`, limit]
  );
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------

export interface BusinessCoreValues {
  name: string;
  branch: string | null;
  normalizedName: string;
  normalizedBranch: string;
  nameKey: string;
  categoryId: string;
  website: string | null;
  notes: string | null;
}

export async function insertBusiness(db: Queryable, v: BusinessCoreValues, actorId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO businesses (name, branch, normalized_name, normalized_branch, name_key, category_id, website, notes,
                             created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     RETURNING id`,
    [v.name, v.branch, v.normalizedName, v.normalizedBranch, v.nameKey, v.categoryId, v.website, v.notes, actorId]
  );
  return rows[0].id;
}

/** Optimistic update (plan §4.5). Returns the new version, or null when the version did not match. */
export async function updateBusinessCore(
  db: Queryable,
  id: string,
  expectedVersion: number,
  v: BusinessCoreValues,
  actorId: string
): Promise<number | null> {
  const { rows } = await db.query<{ version: number }>(
    `UPDATE businesses
        SET name = $3, branch = $4, normalized_name = $5, normalized_branch = $6, name_key = $7, category_id = $8,
            website = $9, notes = $10, updated_by = $11, version = version + 1, updated_at = now()
      WHERE id = $1 AND version = $2
      RETURNING version`,
    [id, expectedVersion, v.name, v.branch, v.normalizedName, v.normalizedBranch, v.nameKey, v.categoryId, v.website, v.notes, actorId]
  );
  return rows[0]?.version ?? null;
}

export async function setArchived(
  db: Queryable,
  id: string,
  expectedVersion: number,
  archived: boolean,
  actorId: string
): Promise<number | null> {
  const { rows } = await db.query<{ version: number }>(
    `UPDATE businesses
        SET archived_at = CASE WHEN $3 THEN now() ELSE NULL END,
            archived_by = CASE WHEN $3 THEN $4::uuid ELSE NULL END,
            updated_by = $4, version = version + 1, updated_at = now()
      WHERE id = $1 AND version = $2
      RETURNING version`,
    [id, expectedVersion, archived, actorId]
  );
  return rows[0]?.version ?? null;
}

export interface PhoneValues {
  countryCode: string;
  number: string;
  normalized: string;
}

/**
 * Replace the phone set: rows whose normalised value stays are updated in place, removed ones are
 * deleted, new ones inserted. The global UNIQUE index on `normalized_phone` is the DR-8 race guard.
 */
export async function replacePhones(db: Queryable, businessId: string, phones: PhoneValues[]): Promise<void> {
  const keep = phones.map((p) => p.normalized);
  await db.query(
    `DELETE FROM business_phones WHERE business_id = $1 AND NOT (normalized_phone = ANY($2::varchar[]))`,
    [businessId, keep]
  );
  for (let i = 0; i < phones.length; i++) {
    const p = phones[i];
    const upd = await db.query(
      `UPDATE business_phones SET country_code = $3, number = $4, position = $5, updated_at = now()
        WHERE business_id = $1 AND normalized_phone = $2`,
      [businessId, p.normalized, p.countryCode, p.number, i]
    );
    if (upd.rowCount === 0) {
      await db.query(
        `INSERT INTO business_phones (business_id, country_code, number, normalized_phone, position) VALUES ($1, $2, $3, $4, $5)`,
        [businessId, p.countryCode, p.number, p.normalized, i]
      );
    }
  }
}

export interface SocialValues {
  platform: string;
  handle: string;
  normalizedHandle: string;
  followers: number | null;
  lastPost: string | null;
}

/**
 * Replace the social accounts. Latest metric value only (DEC-014/023): `metrics_recorded_at` is kept when
 * the same account's metrics are unchanged, set to `now` when they change, NULL when both are Unknown.
 */
export async function replaceSocials(db: Queryable, businessId: string, socials: SocialValues[], now: Date): Promise<void> {
  const { rows: previous } = await db.query<{
    platform: string;
    normalized_handle: string;
    followers: number | null;
    last_post: string | null;
    metrics_recorded_at: Date | null;
  }>(
    `SELECT platform, normalized_handle, followers, to_char(last_post_date, 'YYYY-MM-DD') AS last_post, metrics_recorded_at
       FROM social_accounts WHERE business_id = $1`,
    [businessId]
  );
  await db.query('DELETE FROM social_accounts WHERE business_id = $1', [businessId]);
  for (let i = 0; i < socials.length; i++) {
    const s = socials[i];
    const prev = previous.find((p) => p.platform === s.platform && p.normalized_handle === s.normalizedHandle);
    const unknown = s.followers === null && s.lastPost === null;
    const same = prev && prev.followers === s.followers && prev.last_post === s.lastPost;
    const recordedAt = unknown ? null : same ? prev.metrics_recorded_at : now;
    await db.query(
      `INSERT INTO social_accounts (business_id, platform, handle, normalized_handle, followers, last_post_date, metrics_recorded_at, position)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8)`,
      [businessId, s.platform, s.handle, s.normalizedHandle, s.followers, s.lastPost, recordedAt, i]
    );
  }
}

export interface HistoryInsert {
  businessId: string;
  kind: 'created' | 'updated' | 'archived' | 'restored';
  field: string | null;
  before: unknown;
  after: unknown;
  actorId: string | null;
  correctionId: string | null;
  requestId: string | null;
}

export async function insertHistory(db: Queryable, h: HistoryInsert): Promise<void> {
  await db.query(
    `INSERT INTO business_edit_history (business_id, change_kind, field, before_value, after_value, changed_by, correction_request_id, request_id)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)`,
    [
      h.businessId,
      h.kind,
      h.field,
      h.before === undefined ? null : JSON.stringify(h.before),
      h.after === undefined ? null : JSON.stringify(h.after),
      h.actorId,
      h.correctionId,
      h.requestId,
    ]
  );
}

export interface HistoryDbRow {
  id: string;
  changed_at: Date;
  change_kind: 'created' | 'updated' | 'archived' | 'restored';
  field: string | null;
  before_value: unknown;
  after_value: unknown;
  changed_by: string | null;
  changed_by_name: string | null;
  correction_request_id: string | null;
}

export async function listHistory(
  db: Queryable,
  businessId: string,
  excludeFields: readonly string[],
  page: number,
  pageSize: number
): Promise<{ rows: HistoryDbRow[]; total: number }> {
  const where = `h.business_id = $1 AND (h.field IS NULL OR NOT (h.field = ANY($2::varchar[])))`;
  const { rows: count } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM business_edit_history h WHERE ${where}`,
    [businessId, excludeFields]
  );
  const { rows } = await db.query<HistoryDbRow>(
    `SELECT h.id, h.changed_at, h.change_kind, h.field, h.before_value, h.after_value, h.changed_by,
            e.full_name AS changed_by_name, h.correction_request_id
       FROM business_edit_history h LEFT JOIN employees e ON e.id = h.changed_by
      WHERE ${where}
      ORDER BY h.changed_at DESC, h.id DESC
      LIMIT $3 OFFSET $4`,
    [businessId, excludeFields, pageSize, (page - 1) * pageSize]
  );
  return { rows, total: count[0].n };
}

// ---------------------------------------------------------------------------------------------
// Duplicate lookups (DR-1..DR-9). They ignore visibility (C3) and include archived records (OI-26).
// ---------------------------------------------------------------------------------------------

export async function findPhoneMatch(
  db: Queryable,
  normalized: readonly string[],
  excludeBusinessId: string | null
): Promise<{ business_id: string; normalized_phone: string } | null> {
  if (normalized.length === 0) return null;
  const { rows } = await db.query<{ business_id: string; normalized_phone: string }>(
    `SELECT business_id, normalized_phone FROM business_phones
      WHERE normalized_phone = ANY($1::varchar[]) AND ($2::uuid IS NULL OR business_id <> $2::uuid)
      ORDER BY created_at LIMIT 1`,
    [normalized, excludeBusinessId]
  );
  return rows[0] ?? null;
}

export async function findNameMatch(
  db: Queryable,
  key: string,
  normalizedName: string,
  normalizedBranch: string,
  excludeBusinessId: string | null
): Promise<{ id: string } | null> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM businesses
      WHERE (name_key = $1 OR (name_key IS NULL AND normalized_name = $2 AND normalized_branch = $3))
        AND ($4::uuid IS NULL OR id <> $4::uuid)
      ORDER BY created_at LIMIT 1`,
    [key, normalizedName, normalizedBranch, excludeBusinessId]
  );
  return rows[0] ?? null;
}

export async function findSimilarNames(
  db: Queryable,
  normalizedName: string,
  threshold: number,
  excludeBusinessId: string | null,
  limit = 20
): Promise<{ id: string; name: string; branch: string | null; similarity: number; archived: boolean }[]> {
  const { rows } = await db.query<{ id: string; name: string; branch: string | null; similarity: number; archived: boolean }>(
    `SELECT id, name, branch, round(similarity(normalized_name, $1)::numeric, 3)::float8 AS similarity,
            archived_at IS NOT NULL AS archived
       FROM businesses
      WHERE similarity(normalized_name, $1) >= $2
        AND normalized_name <> $1
        AND ($3::uuid IS NULL OR id <> $3::uuid)
      ORDER BY similarity(normalized_name, $1) DESC, created_at
      LIMIT $4`,
    [normalizedName, threshold, excludeBusinessId, limit]
  );
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------

export interface CategoryDbRow {
  id: string;
  name: string;
  normalized_name: string;
  is_active: boolean;
  is_system: boolean;
  updated_by_name: string | null;
  updated_at: Date;
  version: number;
  business_count: number;
}

export async function findCategory(db: Queryable, id: string, forUpdate = false): Promise<CategoryDbRow | null> {
  const { rows } = await db.query<CategoryDbRow>(
    `SELECT c.id, c.name, c.normalized_name, c.is_active, c.is_system, e.full_name AS updated_by_name, c.updated_at, c.version,
            (SELECT count(*)::int FROM businesses b WHERE b.category_id = c.id) AS business_count
       FROM categories c LEFT JOIN employees e ON e.id = COALESCE(c.updated_by, c.created_by)
      WHERE c.id = $1 ${forUpdate ? 'FOR UPDATE OF c' : ''}`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findCategoryByNormalizedName(db: Queryable, normalizedName: string): Promise<CategoryDbRow | null> {
  const { rows } = await db.query<{ id: string }>('SELECT id FROM categories WHERE normalized_name = $1', [normalizedName]);
  return rows[0] ? findCategory(db, rows[0].id) : null;
}

/**
 * Category list. `countScope` is a business predicate over alias `b` (the caller's scopeFilter), so
 * non-Owner counts never include hidden businesses.
 */
export async function listCategories(
  db: Queryable,
  opts: { activeOnly: boolean; countScope: string; params: SqlParams; page: number; pageSize: number }
): Promise<{ rows: CategoryDbRow[]; total: number }> {
  const p = opts.params;
  const where = opts.activeOnly ? 'c.is_active' : 'TRUE';
  const { rows: count } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM categories c WHERE ${where}`, []);
  const limit = p.add(opts.pageSize);
  const offset = p.add((opts.page - 1) * opts.pageSize);
  const { rows } = await db.query<CategoryDbRow>(
    `SELECT c.id, c.name, c.normalized_name, c.is_active, c.is_system, e.full_name AS updated_by_name, c.updated_at, c.version,
            (SELECT count(*)::int FROM businesses b WHERE b.category_id = c.id AND ${opts.countScope}) AS business_count
       FROM categories c LEFT JOIN employees e ON e.id = COALESCE(c.updated_by, c.created_by)
      WHERE ${where}
      ORDER BY c.is_system ASC, lower(c.name) ASC
      LIMIT ${limit} OFFSET ${offset}`,
    p.values
  );
  return { rows, total: count[0].n };
}

export async function insertCategory(db: Queryable, name: string, normalizedName: string, actorId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO categories (name, normalized_name, created_by, updated_by) VALUES ($1, $2, $3, $3) RETURNING id`,
    [name, normalizedName, actorId]
  );
  return rows[0].id;
}

export async function renameCategory(
  db: Queryable,
  id: string,
  version: number,
  name: string,
  normalizedName: string,
  actorId: string
): Promise<number | null> {
  const { rows } = await db.query<{ version: number }>(
    `UPDATE categories SET name = $3, normalized_name = $4, updated_by = $5, version = version + 1, updated_at = now()
      WHERE id = $1 AND version = $2 RETURNING version`,
    [id, version, name, normalizedName, actorId]
  );
  return rows[0]?.version ?? null;
}

export async function deactivateCategory(db: Queryable, id: string, version: number, actorId: string): Promise<number | null> {
  const { rows } = await db.query<{ version: number }>(
    `UPDATE categories SET is_active = FALSE, updated_by = $3, version = version + 1, updated_at = now()
      WHERE id = $1 AND version = $2 AND NOT is_system RETURNING version`,
    [id, version, actorId]
  );
  return rows[0]?.version ?? null;
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** SQL literal for `LIKE … ESCAPE <this>`: a single backslash (standard_conforming_strings). */
export const LIKE_ESCAPE = String.raw`'\'`;

/** Escape LIKE wildcards; use with `ESCAPE ${LIKE_ESCAPE}`. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

// ---------------------------------------------------------------------------------------------
// Directory list and search. `scope` is the caller's access predicate over alias `b` (built with the
// same SqlParams); it is ANDed BEFORE count, sort and paging, so hidden rows are never counted.
// ---------------------------------------------------------------------------------------------

export interface ListSql {
  /** Predicates over aliases b / c / ce, ANDed. Includes the access scope. */
  where: string[];
  /** Extra predicate for the `flag` filter (not applied to `counts`/`facets`). */
  flagWhere: string | null;
  orderBy: string;
  params: SqlParams;
  page: number;
  pageSize: number;
  /** Extra SELECT columns, built just before the row query (their params must not leak into the counts). */
  extraCols: (p: SqlParams) => string[];
}

const FROM_LIST = `FROM businesses b JOIN categories c ON c.id = b.category_id LEFT JOIN employees ce ON ce.id = b.created_by`;

export async function listBusinessRows(
  db: Queryable,
  q: ListSql
): Promise<{ rows: BusinessDbRow[]; total: number; correctionRequested: number; categories: string[]; creators: string[] }> {
  const base = q.where.length ? q.where.join(' AND ') : 'TRUE';
  const all = q.flagWhere ? `${base} AND ${q.flagWhere}` : base;
  const p = q.params;
  const { rows: totals } = await db.query<{ n: number; corr: number }>(
    `SELECT (SELECT count(*)::int ${FROM_LIST} WHERE ${all}) AS n,
            (SELECT count(*)::int ${FROM_LIST}
              WHERE ${base} AND EXISTS (SELECT 1 FROM access_facts afc WHERE afc.business_id = b.id AND afc.has_open_correction)) AS corr`,
    p.values
  );
  const { rows: facets } = await db.query<{ categories: string[] | null; creators: string[] | null }>(
    `SELECT (SELECT array_agg(DISTINCT c.name ORDER BY c.name) ${FROM_LIST} WHERE ${base}) AS categories,
            (SELECT array_agg(DISTINCT ce.full_name ORDER BY ce.full_name) ${FROM_LIST} WHERE ${base} AND ce.full_name IS NOT NULL) AS creators`,
    p.values
  );
  const extra = q.extraCols(p);
  const limit = p.add(q.pageSize);
  const offset = p.add((q.page - 1) * q.pageSize);
  const { rows } = await db.query<BusinessDbRow>(
    `${businessSelect(extra)} WHERE ${all} ${q.orderBy} LIMIT ${limit} OFFSET ${offset}`,
    p.values
  );
  return {
    rows,
    total: totals[0].n,
    correctionRequested: totals[0].corr,
    categories: (facets[0].categories ?? []).slice(0, 200),
    creators: (facets[0].creators ?? []).slice(0, 200),
  };
}

export interface SearchSql {
  scope: string;
  params: SqlParams;
  /** Normalised name fragment, or null when the term has no letters/digits. */
  name: string | null;
  /** Phone digits (>= 3), or null. */
  phoneDigits: string | null;
  /** Normalised handle fragment, or null. */
  handle: string | null;
  matchType: 'name' | 'phone' | 'social' | null;
  page: number;
  pageSize: number;
  extraCols: (p: SqlParams) => string[];
}

export interface SearchDbRow extends BusinessDbRow {
  m_name: boolean;
  m_phone: boolean;
  m_social: boolean;
}

export async function searchBusinessRows(
  db: Queryable,
  q: SearchSql
): Promise<{ rows: SearchDbRow[]; counts: { all: number; name: number; phone: number; social: number } }> {
  const p = q.params;
  const nameP = q.name ? p.add(`%${escapeLike(q.name)}%`) : null;
  const phoneP = q.phoneDigits ? p.add(`%${escapeLike(q.phoneDigits)}%`) : null;
  const handleP = q.handle ? p.add(`%${escapeLike(q.handle)}%`) : null;
  const mName = nameP ? `(b.normalized_name LIKE ${nameP} ESCAPE ${LIKE_ESCAPE})` : 'FALSE';
  const mPhone = phoneP
    ? `EXISTS (SELECT 1 FROM business_phones sp WHERE sp.business_id = b.id AND sp.normalized_phone LIKE ${phoneP} ESCAPE ${LIKE_ESCAPE})`
    : 'FALSE';
  const mSocial = handleP
    ? `EXISTS (SELECT 1 FROM social_accounts ss WHERE ss.business_id = b.id AND ss.normalized_handle LIKE ${handleP} ESCAPE ${LIKE_ESCAPE})`
    : 'FALSE';
  const any = `(${mName} OR ${mPhone} OR ${mSocial})`;
  const { rows: c } = await db.query<{ all: number; name: number; phone: number; social: number }>(
    `SELECT count(*) FILTER (WHERE ${any})::int AS all,
            count(*) FILTER (WHERE ${mName})::int AS name,
            count(*) FILTER (WHERE ${mPhone})::int AS phone,
            count(*) FILTER (WHERE ${mSocial})::int AS social
       FROM businesses b WHERE ${q.scope}`,
    p.values
  );
  const pick = q.matchType === 'name' ? mName : q.matchType === 'phone' ? mPhone : q.matchType === 'social' ? mSocial : any;
  const extra = q.extraCols(p);
  const limit = p.add(q.pageSize);
  const offset = p.add((q.page - 1) * q.pageSize);
  const { rows } = await db.query<SearchDbRow>(
    `${businessSelect([...extra, `${mName} AS m_name`, `${mPhone} AS m_phone`, `${mSocial} AS m_social`])}
      WHERE ${q.scope} AND ${pick}
      ORDER BY ${mName} DESC, lower(b.name) ASC, b.id ASC
      LIMIT ${limit} OFFSET ${offset}`,
    p.values
  );
  return { rows, counts: c[0] };
}
