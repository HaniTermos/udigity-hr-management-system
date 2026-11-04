'use client';

import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';

/** Confirms closing/reloading the tab and following in-app links while the form has unsaved changes. */
export function useUnsavedChangesGuard(active: boolean) {
  useUnsavedGuard(active);
}
