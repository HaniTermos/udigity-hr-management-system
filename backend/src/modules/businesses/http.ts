/**
 * MOD-business — HTTP helpers shared by the BE2 routers (businesses, categories, search, corrections). Owner: BE2.
 * - `parse`: Zod parse whose 400 `details` are keyed by the full field path (`phones.0.number`), with every
 *   failed field reported together (AC-BIZ-001 error summary).
 * - `perUserLimiter`: rate limit for duplicate-check and search (security checklist 7).
 */
import type { Request } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { HttpError, notFound } from '../../shared/errors.js';

const IdParam = z.object({ id: z.string().uuid() }).strict();

/** Path id: a malformed id is a 404 (no hint whether anything exists). */
export function idOf(req: Request): string {
  const r = IdParam.safeParse(req.params);
  if (!r.success) throw notFound();
  return r.data.id;
}

export function parse<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
  extra?: (raw: unknown) => Record<string, string[]>
): z.infer<S> {
  const r = schema.safeParse(data);
  const extraErrors = extra ? extra(data) : {};
  if (r.success && Object.keys(extraErrors).length === 0) return r.data;
  const details: Record<string, string[]> = { ...extraErrors };
  if (!r.success) {
    for (const issue of r.error.issues) {
      const key = issue.path.length ? issue.path.join('.') : '_';
      const list = (details[key] ??= []);
      if (!list.includes(issue.message)) list.push(issue.message);
    }
  }
  throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', details);
}

/** Create needs a category; reported with the other field errors even when the object fails Zod. */
export function categoryRequired(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {};
  const b = raw as Record<string, unknown>;
  const hasId = typeof b.categoryId === 'string' && b.categoryId.trim() !== '';
  const hasName = typeof b.category === 'string' && b.category.trim() !== '';
  return hasId || hasName ? {} : { category: ['Choose a category'] };
}

