'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { classifyError, sessionEndedPathFor, SESSION_ENDED_PATH, type ErrorRoute } from '@/lib/errorRouting';
import { isPublicPath } from '@/lib/authRoutes';
import { signalSessionEnded } from '@/lib/sessionEndedSignal';

/**
 * `routeError(err)` classifies an API failure and performs the one navigation that is global:
 * a 401 on a protected page opens the in-app session-ended dialog (AppShell), or goes to
 * /session-ended when no shell is mounted (SHR-013). Everything else is returned for the
 * screen to render with `<ApiErrorView route={...} />`, a toast, or inline field errors.
 */
export function useErrorRouter() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (error: unknown): ErrorRoute => {
      const route = classifyError(error);
      if (route.kind === 'session-ended' && !isPublicPath(pathname) && pathname !== SESSION_ENDED_PATH) {
        // Inside the app shell: show the in-app dialog over the page instead of leaving it.
        if (signalSessionEnded(route.reason)) return route;
        const here = typeof window === 'undefined' ? pathname : window.location.pathname + window.location.search;
        router.replace(sessionEndedPathFor(route.reason, here));
      }
      return route;
    },
    [router, pathname]
  );
}
