'use client';

import { useRef } from 'react';
import useSWR, { type KeyedMutator, type SWRConfiguration } from 'swr';
import { ApiError, buildQuery, swrFetcher, type Page, type PageQuery, type QueryValue } from '@/lib/api';
import { classifyError, isRetryable, type ErrorRoute } from '@/lib/errorRouting';
import { DEFAULT_POLL_MS, effectivePollMs, stopsPolling } from '@/lib/polling';

export interface UseApiResult<T> {
  data: T | undefined;
  error: ApiError | undefined;
  /** What the error means for the UI (lib/errorRouting.ts); null while there is no error. */
  route: ErrorRoute | null;
  isLoading: boolean;
  isValidating: boolean;
  /** Re-fetch: use after a mutation and for "Try again". */
  retry: () => Promise<T | undefined>;
  mutate: KeyedMutator<T>;
}

/**
 * GET `path` through the typed client with SWR. Pass `null` to wait (dependent fetches).
 * Only network/5xx/429 failures are retried automatically (3 times, backing off); 4xx are final and
 * the screen decides (SHR-011..015).
 */
export function useApi<T>(path: string | null, config?: SWRConfiguration<T, ApiError>): UseApiResult<T> {
  // Polling policy (lib/polling.ts): off unless the caller sets an interval, paused while the tab is hidden,
  // and stopped for a key that answered 401/403/404.
  const base = typeof config?.refreshInterval === 'number' ? config.refreshInterval : DEFAULT_POLL_MS;
  const blocked = useRef<{ key: string | null; status: number | undefined }>({ key: null, status: undefined });
  const { data, error, isLoading, isValidating, mutate } = useSWR<T, ApiError>(path, (key: string) => swrFetcher<T>(key), {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1500,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    onErrorRetry: (err, _key, _cfg, revalidate, { retryCount }) => {
      if (!isRetryable(err) || retryCount >= 3) return;
      setTimeout(() => revalidate({ retryCount }), 2000 * (retryCount + 1));
    },
    ...config,
    refreshInterval: () => effectivePollMs(base, blocked.current.key === path ? blocked.current.status : undefined),
    onError: (err, key, cfg) => {
      if (err instanceof ApiError && stopsPolling(err.status)) blocked.current = { key, status: err.status };
      config?.onError?.(err, key, cfg);
    },
    onSuccess: (d, key, cfg) => {
      if (blocked.current.key === key) blocked.current = { key: null, status: undefined };
      config?.onSuccess?.(d, key, cfg);
    },
  });
  return {
    data,
    error,
    route: error ? classifyError(error) : null,
    isLoading,
    isValidating,
    retry: () => mutate(),
    mutate,
  };
}

export type PageParams = PageQuery & Record<string, QueryValue>;

/** Paged list: `usePage('/api/businesses', { page, pageSize, q })`. Keeps the previous page while loading. */
export function usePage<T>(path: string | null, query?: PageParams, config?: SWRConfiguration<Page<T>, ApiError>) {
  const key = path ? `${path}${buildQuery(query)}` : null;
  const result = useApi<Page<T>>(key, { keepPreviousData: true, ...config });
  const pageCount = result.data ? Math.max(1, Math.ceil(result.data.total / Math.max(1, result.data.pageSize))) : 1;
  return { ...result, items: result.data?.items ?? [], total: result.data?.total ?? 0, pageCount };
}
