'use client';

import useSWR, { type KeyedMutator, type SWRConfiguration } from 'swr';
import { ApiError, buildQuery, swrFetcher, type Page, type PageQuery, type QueryValue } from '@/lib/api';
import { classifyError, isRetryable, type ErrorRoute } from '@/lib/errorRouting';

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
  const { data, error, isLoading, isValidating, mutate } = useSWR<T, ApiError>(path, (key: string) => swrFetcher<T>(key), {
    refreshInterval: 4000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1500,
    onErrorRetry: (err, _key, _cfg, revalidate, { retryCount }) => {
      if (!isRetryable(err) || retryCount >= 3) return;
      setTimeout(() => revalidate({ retryCount }), 2000 * (retryCount + 1));
    },
    ...config,
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
