/**
 * Tiny parameter collector for raw `pg` SQL (plan.md §4). Owner: Tech Lead.
 * Lets independent helpers (access scopeFilter, pagination, module filters) contribute
 * placeholders to one statement without manual `$n` arithmetic.
 *
 *   const p = new SqlParams();
 *   const where = [`b.category_id = ${p.add(categoryId)}`, access.scopeFilter(principal, 'business.list', 'business', { alias: 'b', params: p })];
 *   await tx.query(`SELECT ... FROM businesses b WHERE ${where.join(' AND ')} ${pageClause(page, p)}`, p.values);
 *
 * Never interpolate user input into SQL text. Identifiers (sort columns) come from whitelists only.
 */
export class SqlParams {
  readonly values: unknown[] = [];

  /** Adds a value and returns its placeholder, e.g. `$3`. */
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}
