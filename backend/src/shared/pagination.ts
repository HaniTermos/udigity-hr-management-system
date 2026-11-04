/**
 * Pagination, sorting and list responses (plan.md §4.4). Owner: Tech Lead.
 *
 * Request:  GET /api/<resource>?page=1&pageSize=25&sort=createdAt&order=desc
 * Response: { items: T[], page, pageSize, total }
 *
 * - Offset pagination (data volume is thousands of rows at most).
 * - `total` is counted AFTER `access.scopeFilter`, so hidden rows are never counted (arch-b §7).
 * - `sort` must be a key of the endpoint's whitelist; it maps to a SQL column expression.
 */
import { z } from 'zod';
import { SqlParams } from './sql.js';
import { HttpError } from './errors.js';
import { safeString } from './validation.js';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
/** Controls gap API4: highest page number accepted (100 rows x 10,000 pages; far beyond any list here). */
export const MAX_PAGE = 10_000;

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sort: safeString().max(40).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PageQuery = z.infer<typeof PageQuerySchema>;

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Resolve `sort` against a whitelist of `{ apiKey: sqlExpression }`. No `sort` = the `fallback` key.
 * An unknown `sort` is a 400 VALIDATION_ERROR on every list route (review C-11), never silently ignored.
 * `tieBreaker` (e.g. `'b.id'`) is appended with the same direction so OFFSET pages are stable (C-02);
 * every OFFSET-paged query must pass one (or append its own unique column).
 * The returned string is safe to embed (never user text).
 */
export function orderByClause(
  query: Pick<PageQuery, 'sort' | 'order'>,
  whitelist: Record<string, string>,
  fallback: string,
  tieBreaker?: string
): string {
  if (query.sort !== undefined && !Object.prototype.hasOwnProperty.call(whitelist, query.sort)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', {
      sort: [`Unknown sort. Use one of: ${Object.keys(whitelist).join(', ')}`],
    });
  }
  const column = (query.sort ? whitelist[query.sort] : whitelist[fallback]) ?? fallback;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${column} ${direction}${tieBreaker ? `, ${tieBreaker} ${direction}` : ''}`;
}

/** `LIMIT $n OFFSET $m` using the shared parameter list. */
export function pageClause(query: Pick<PageQuery, 'page' | 'pageSize'>, params: SqlParams): string {
  const limit = params.add(query.pageSize);
  const offset = params.add((query.page - 1) * query.pageSize);
  return `LIMIT ${limit} OFFSET ${offset}`;
}

/**
 * C-06: a count query that reuses a list query's parameters must still reference the LIMIT/OFFSET
 * placeholders of `page`, because access filters may add parameters after them (the bind count must match).
 * Appends them as a no-op condition; use with the full `params.values`.
 */
export function keepPagePlaceholders(page: string): string {
  const placeholders = page.match(/\$\d+/g) ?? [];
  return placeholders.length ? ` AND (${placeholders.map((p) => `${p}::bigint`).join(' + ')}) IS NOT NULL` : '';
}

export function toPage<T>(items: T[], total: number, query: Pick<PageQuery, 'page' | 'pageSize'>): PageResult<T> {
  return { items, page: query.page, pageSize: query.pageSize, total };
}
