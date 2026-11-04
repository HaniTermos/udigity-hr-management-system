'use client';

import { ACTIONS } from '@/lib/actions';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth';
import {
  getBusiness,
  getBusinessHistory,
  listBusinesses,
  listCategories,
  searchBusinesses,
  type BusinessQuery,
  type SearchQuery,
} from '@/lib/api/businesses';
import { roleDefaultAllows } from '@/lib/actions';
import { getCorrection, listCorrections, type CorrectionQuery } from '@/lib/api/corrections';

export function useBusinessAccess() {
  const { user, can, capabilities } = useAuth();
  const role = user?.role ?? null;
  const allowed = (action: string): boolean => {
    if (!role) return false;
    if (capabilities) return can(action);
    return roleDefaultAllows(action, role);
  };
  return { role, user, allowed };
}

/** Keys are arrays so SWR serialises them stably. They include the role so persona switches never reuse another role's rows. */
export function useBusinessList(q: BusinessQuery) {
  const { role } = useBusinessAccess();
  return useSWR(role ? ['businesses', q, role] : null, () => listBusinesses(q), { keepPreviousData: true, shouldRetryOnError: false });
}

export function useBusiness(id: string) {
  const { role } = useBusinessAccess();
  return useSWR(role ? ['business', id, role] : null, () => getBusiness(id), { shouldRetryOnError: false });
}

export function useBusinessHistory(id: string, enabled: boolean, page = 1) {
  const { role } = useBusinessAccess();
  return useSWR(role && enabled ? ['business-history', id, page, role] : null, () => getBusinessHistory(id, page), { shouldRetryOnError: false });
}

export function useCategories() {
  const { role } = useBusinessAccess();
  return useSWR(role ? ['categories', role] : null, () => listCategories(), { shouldRetryOnError: false });
}

export function useBusinessSearch(q: SearchQuery) {
  const { role } = useBusinessAccess();
  return useSWR(role && q.q.trim().length >= 2 ? ['search', q, role] : null, () => searchBusinesses(q), { keepPreviousData: true, shouldRetryOnError: false });
}

export function useCorrections(q: CorrectionQuery) {
  const { role, allowed } = useBusinessAccess();
  return useSWR(role && allowed(ACTIONS.correctionRead) ? ['corrections', q, role] : null, () => listCorrections(q), { keepPreviousData: true, shouldRetryOnError: false });
}

export function useCorrection(id: string | null) {
  return useSWR(id ? ['correction', id] : null, () => getCorrection(id as string), { shouldRetryOnError: false });
}
