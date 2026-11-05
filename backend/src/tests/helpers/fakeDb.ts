/**
 * Minimal scripted stand-in for pg, used by unit tests that must not touch a database.
 * Each handler matches SQL text by regex and returns rows; unmatched queries return no rows.
 */
export interface RecordedQuery {
  text: string;
  params: unknown[];
}

type Handler = (params: unknown[]) => { rows: unknown[]; rowCount?: number };

export class FakeDb {
  calls: RecordedQuery[] = [];
  private handlers: Array<[RegExp, Handler]> = [];

  on(pattern: RegExp, handler: Handler | unknown[]): this {
    const fn: Handler = typeof handler === 'function' ? (handler as Handler) : () => ({ rows: handler as unknown[] });
    this.handlers.unshift([pattern, fn]);
    return this;
  }

  reset(): void {
    this.calls = [];
    this.handlers = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(text: string, params: unknown[] = []): Promise<any> {
    const normalized = text.replace(/\s+/g, ' ').trim();
    this.calls.push({ text: normalized, params });
    for (const [pattern, fn] of this.handlers) {
      if (pattern.test(normalized)) {
        const r = fn(params);
        return { rows: r.rows, rowCount: r.rowCount ?? r.rows.length };
      }
    }
    return { rows: [], rowCount: 1 };
  }

  find(pattern: RegExp): RecordedQuery[] {
    return this.calls.filter((c) => pattern.test(c.text));
  }
}
