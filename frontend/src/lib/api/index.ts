/**
 * `@/lib/api` entry. Owner: Tech Lead.
 * - ./http.ts   Increment 1 transport (`apiFetch`, CSRF handling). Used by lib/auth.tsx; unchanged.
 * - ./client.ts typed, throwing client for domain modules (`api`, `ApiError`, `swrFetcher`).
 * - ./types.ts  shared contract types.
 * - ./<domain>.ts one file per backend module domain (owners in plan.md §3).
 */
export * from './http';
export * from './client';
export * from './types';
export * from './rateLimit';
