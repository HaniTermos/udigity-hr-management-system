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

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sort: z.string().max(40).optional(),
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
 * Resolve `sort` against a whitelist of `{ apiKey: sqlExpression }`.
 * Unknown keys fall back to `fallback`. The returned string is safe to embed (never user text).
 */
export function orderByClause(
  query: Pick<PageQuery, 'sort' | 'order'>,
  whitelist: Record<string, string>,
  fallback: string
): string {
  const column = (query.sort && Object.prototype.hasOwnProperty.call(whitelist, query.sort)
    ? whitelist[query.sort]
    : whitelist[fallback]) ?? fallback;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${column} ${direction}`;
}

/** `LIMIT $n OFFSET $m` using the shared parameter list. */
export function pageClause(query: Pick<PageQuery, 'page' | 'pageSize'>, params: SqlParams): string {
  const limit = params.add(query.pageSize);
  const offset = params.add((query.page - 1) * query.pageSize);
  return `LIMIT ${limit} OFFSET ${offset}`;
}

export function toPage<T>(items: T[], total: number, query: Pick<PageQuery, 'page' | 'pageSize'>): PageResult<T> {
  return { items, page: query.page, pageSize: query.pageSize, total };
}
