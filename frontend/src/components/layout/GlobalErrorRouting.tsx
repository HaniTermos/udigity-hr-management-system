'use client';

import React from 'react';
import { SWRConfig } from 'swr';
import { useErrorRouter } from '@/lib/hooks/useErrorRouter';

/**
 * App-wide SWR error handling. A 401 from any SWR fetch on a protected page sends the user to
 * /session-ended (SHR-013). Every other failure is left to the screen (`useApi().route` +
 * `<ApiErrorView>`). `/api/auth/me` swallows its own 401 (the shell guard handles signed-out users).
 */
export function GlobalErrorRouting({ children }: { children: React.ReactNode }) {
  const routeError = useErrorRouter();
  return (
    <SWRConfig
      value={{
        onError: (error, key) => {
          if (key === '/api/auth/me') return;
          routeError(error);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
