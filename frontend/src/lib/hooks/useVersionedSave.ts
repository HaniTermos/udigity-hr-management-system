'use client';

import { useCallback, useRef, useState } from 'react';
import { ApiError, newIdempotencyKey } from '@/lib/api';
import { classifyError, type ErrorRoute } from '@/lib/errorRouting';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'failed';

export interface SaveContext {
  version: number;
  /** Stable for the whole user action, including retries (plan.md §4.7). */
  idempotencyKey: string;
}

export interface UseVersionedSaveResult<TInput, TResult> {
  status: SaveStatus;
  /** Set when the server answered 409 VERSION_CONFLICT. Show SCR-SHR-014 with this. */
  conflict: { currentVersion?: number; attempted: TInput } | null;
  /** Server validation messages by field, for inline errors. */
  fieldErrors: Record<string, string[]>;
  error: ApiError | null;
  /** What the failure means (offline, session ended, permission...): lib/errorRouting.ts. */
  route: ErrorRoute | null;
  /** Resolves with the saved record, or undefined when the save failed (state is on the hook). */
  save: (input: TInput, version: number) => Promise<TResult | undefined>;
  /** Repeat the last attempt with the same idempotency key ("Try again"). */
  retry: () => Promise<TResult | undefined>;
  reset: () => void;
}

/**
 * Save with optimistic concurrency (plan.md §4.5, §9). No optimistic UI: the hook reports `saving`,
 * then `saved`, `conflict` (409) or `failed`. Edits stay in the caller's form state, so a conflict or
 * failure never loses them.
 */
export function useVersionedSave<TInput, TResult>(
  send: (input: TInput, ctx: SaveContext) => Promise<TResult>,
  options?: { onSaved?: (result: TResult) => void }
): UseVersionedSaveResult<TInput, TResult> {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [conflict, setConflict] = useState<UseVersionedSaveResult<TInput, TResult>['conflict']>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [route, setRoute] = useState<ErrorRoute | null>(null);
  const last = useRef<{ input: TInput; version: number; key: string } | null>(null);
  const onSaved = options?.onSaved;

  const run = useCallback(
    async (input: TInput, version: number, key: string) => {
      last.current = { input, version, key };
      setStatus('saving');
      setConflict(null);
      setFieldErrors({});
      setError(null);
      setRoute(null);
      try {
        const result = await send(input, { version, idempotencyKey: key });
        setStatus('saved');
        onSaved?.(result);
        return result;
      } catch (e) {
        const r = classifyError(e);
        setRoute(r);
        if (e instanceof ApiError) setError(e);
        if (r.kind === 'conflict') {
          setConflict({ currentVersion: r.currentVersion, attempted: input });
          setStatus('conflict');
        } else {
          if (r.kind === 'validation') setFieldErrors(r.fieldErrors);
          setStatus('failed');
        }
        return undefined;
      }
    },
    [send, onSaved]
  );

  const save = useCallback((input: TInput, version: number) => run(input, version, newIdempotencyKey()), [run]);
  const retry = useCallback(async () => {
    if (!last.current) return undefined;
    const { input, version, key } = last.current;
    return run(input, version, key);
  }, [run]);
  const reset = useCallback(() => {
    setStatus('idle');
    setConflict(null);
    setFieldErrors({});
    setError(null);
    setRoute(null);
  }, []);

  return { status, conflict, fieldErrors, error, route, save, retry, reset };
}
