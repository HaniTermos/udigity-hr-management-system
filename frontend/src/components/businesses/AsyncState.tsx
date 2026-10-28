import React from 'react';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { HiddenByPolicy } from '@/components/states/HiddenByPolicy';
import { PermissionDenied } from '@/components/states/PermissionDenied';
import { Skeleton, SkeletonTableRow, StateView } from '@/components/ui/State';

/** Maps an `ApiError` to the shared access / error states (plan §9). Hidden records never reveal a name or id. */
export function ErrorState({
  error,
  onRetry,
  className,
  backHref = '/businesses',
  backLabel = 'Back to businesses',
  area,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  /** Where "Back" goes from the hidden-by-policy state (SHR-012). */
  backHref?: string;
  backLabel?: string;
  /** Screen name for the permission-denied state (SHR-011). */
  area?: string;
}) {
  if (error instanceof ApiError) {
    if (error.isHiddenByPolicy) {
      return <HiddenByPolicy backHref={backHref} backLabel={backLabel} showPolicyChips className={className} />;
    }
    if (error.code === 'RATE_LIMITED') {
      return <StateView type="error" title="Too many requests" body="Wait a moment, then try again." className={className} />;
    }
    if (error.isPermissionDenied) return <PermissionDenied area={area} className={className} />;
    if (error.isNotFound) {
      return <StateView type="empty" title="Business not found" body="The link may be wrong, or you cannot open it." className={className} />;
    }
  }
  return (
    <StateView
      type="error"
      className={className}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

/** Figma "Loading" frames: skeleton rows, never a spinner for lists. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-72 max-w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-64 lg:col-span-2 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
