'use client';

import React from 'react';
import { SessionEndedCard } from './SessionEnded';
import { PermissionDenied } from './PermissionDenied';
import { HiddenByPolicy } from './HiddenByPolicy';
import { LoadErrorState } from './SystemStates';
import { StateView } from '@/components/ui/State';
import { Button } from '@/components/ui/Button';
import { classifyError, type ErrorRoute } from '@/lib/errorRouting';
import { rateLimitMessage } from '@/lib/api/rateLimit';

export interface ApiErrorViewProps {
  /** The thrown error, or an already-classified route (`useApi().route`). */
  error?: unknown;
  route?: ErrorRoute | null;
  onRetry?: () => void;
  /** Where "Back" goes for hidden/not-found records. */
  backHref?: string;
  backLabel?: string;
  /** Name of the area for the permission-denied copy. */
  area?: string;
  /** What failed to load, for the generic error copy ("this list", "this record"). */
  what?: string;
  /** `inline` for a failed widget inside a page; `page` replaces the page body. */
  size?: 'page' | 'inline';
  className?: string;
}

/**
 * One component that turns an API failure into the right state screen:
 * 401 -> SHR-013, 403 -> SHR-011, hidden/not found -> SHR-012, otherwise the load-error pattern.
 * A 409 version conflict is not shown here: saves use `useVersionedSave` + `<SaveConflict>`.
 */
export function ApiErrorView({ error, route, onRetry, backHref = '/my-day', backLabel = 'Back to My Day', area, what, size = 'page', className }: ApiErrorViewProps) {
  const r = route ?? classifyError(error);
  switch (r.kind) {
    case 'session-ended':
      return (
        <div className="flex justify-center py-10">
          <SessionEndedCard reason={r.reason} redirect={typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined} />
        </div>
      );
    case 'permission-denied':
      return <PermissionDenied area={area} className={className} />;
    case 'owner-2fa-required':
      return <PermissionDenied variant="owner-2fa" className={className} />;
    case 'hidden-by-policy':
    case 'not-found':
      // Identical copy for "hidden" and "does not exist": never confirm a record exists.
      return <HiddenByPolicy backHref={backHref} backLabel={backLabel} className={className} />;
    case 'offline':
      return (
        <StateView
          type="error"
          size={size}
          title="You’re offline"
          body="We couldn’t reach the server. Your data is safe — try again when your connection returns."
          action={onRetry && <Button variant={size === 'page' ? 'secondary' : 'link'} size="sm" onClick={onRetry}>Try again</Button>}
          className={className}
        />
      );
    case 'rate-limited':
      return (
        <StateView
          type="error"
          size={size}
          title="Too many requests"
          body={r.retryAfterSeconds ? rateLimitMessage(r.retryAfterSeconds, 'requests') : 'Please wait a moment, then try again.'}
          action={onRetry && <Button variant={size === 'page' ? 'secondary' : 'link'} size="sm" onClick={onRetry}>Try again</Button>}
          className={className}
        />
      );
    case 'busy':
      return (
        <StateView
          type="error"
          size={size}
          title="The system is busy"
          body="Try again in a few seconds. Anything you typed is kept."
          action={onRetry && <Button variant={size === 'page' ? 'secondary' : 'link'} size="sm" onClick={onRetry}>Try again</Button>}
          className={className}
        />
      );
    case 'error':
      return <LoadErrorState what={what} onRetry={onRetry} requestId={r.requestId} size={size} className={className} />;
    default:
      return <LoadErrorState what={what} onRetry={onRetry} size={size} className={className} />;
  }
}
