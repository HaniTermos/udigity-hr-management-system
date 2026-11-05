'use client';

import React from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StateView, Skeleton, SkeletonCard, SkeletonTableRow } from '@/components/ui/State';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

/*
 * SCR-SHR-015 System state patterns: loading, empty, no results, load error, validation error, save
 * failed, offline. Screens use these instead of inventing state UI and override only the wording.
 * Lists use skeletons, never spinners.
 */

/** Loading: skeleton rows (table) or cards. `label` is announced, e.g. "Loading businesses…". */
export function LoadingState({ variant = 'rows', rows = 5, label = 'Loading…', className }: { variant?: 'rows' | 'cards' | 'inline'; rows?: number; label?: string; className?: string }) {
  if (variant === 'inline') return <StateView type="loading" size="inline" title={label} className={className} />;
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn('w-full flex flex-col', variant === 'cards' ? 'gap-4' : 'rounded-xl border border-border-default overflow-hidden', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (variant === 'cards' ? <SkeletonCard key={i} /> : <SkeletonTableRow key={i} />))}
    </div>
  );
}

export function EmptyState({ title, body, action, size = 'inline', className }: { title: string; body: string; action?: React.ReactNode; size?: 'page' | 'inline'; className?: string }) {
  return <StateView type="empty" size={size} title={title} body={body} action={action} className={className} />;
}

export function NoResultsState({ query, onClear, size = 'inline', className }: { query?: string; onClear?: () => void; size?: 'page' | 'inline'; className?: string }) {
  return (
    <StateView
      type="no-results"
      size={size}
      title={query ? `No matches for “${query}”` : 'No matches'}
      body="Try a different name, phone or handle, or clear filters."
      action={
        onClear && (
          <Button variant="link" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        )
      }
      className={className}
    />
  );
}

/** Load error: "The list could not load; data is safe." */
export function LoadErrorState({ what = 'this list', onRetry, requestId, size = 'inline', className }: { what?: string; onRetry?: () => void; requestId?: string; size?: 'page' | 'inline'; className?: string }) {
  return (
    <StateView
      type="error"
      size={size}
      title={`Couldn’t load ${what}`}
      body={`Your data is safe. Try again in a moment.${requestId ? ` (ref ${requestId})` : ''}`}
      action={
        onRetry && (
          <Button variant={size === 'page' ? 'secondary' : 'link'} size="sm" onClick={onRetry}>
            Try again
          </Button>
        )
      }
      className={className}
    />
  );
}

export interface ValidationProblem {
  /** Field label and what to do, e.g. "Phone — enter a number like +000 70 000 101". */
  message: string;
  /** Id of the invalid input; the link moves focus to it. */
  fieldId: string;
}

/** Validation error summary shown on submit, above the form (inline field messages stay on the fields). */
export const ValidationSummary = React.forwardRef<HTMLDivElement, { problems: ValidationProblem[]; className?: string }>(
  function ValidationSummary({ problems, className }, ref) {
    if (problems.length === 0) return null;
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        className={cn('rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger-fg px-3 py-2.5 flex items-start gap-3 outline-none', className)}
      >
        <Icon name="alert-circle" size={18} className="shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium leading-5">
            Fix {problems.length} {problems.length === 1 ? 'problem' : 'problems'} before saving
          </p>
          <ul className="flex flex-col gap-0.5 text-[13px] leading-[18px]">
            {problems.map((p) => (
              <li key={p.fieldId}>
                <a
                  href={`#${p.fieldId}`}
                  className="underline focus-ring-outer rounded-xs"
                  onClick={(e) => {
                    const el = document.getElementById(p.fieldId);
                    if (el) {
                      e.preventDefault();
                      el.focus();
                    }
                  }}
                >
                  {p.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
);

/** Save failed: nothing was lost, retry in place. */
export function SaveFailedAlert({ onRetry, isRetrying, className }: { onRetry: () => void; isRetrying?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Alert tone="danger" role="alert" title="Couldn’t save your changes" body="Nothing was lost — your edits are still on this page. Try again." />
      <Button variant="secondary" fullWidth leadingIcon={<Icon name="refresh" size={16} />} onClick={onRetry} isLoading={isRetrying}>
        Try again
      </Button>
    </div>
  );
}

/** "You're offline" banner. Renders nothing while online. Pair save buttons with `useOnlineStatus()`. */
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <Alert
      tone="warning"
      role="status"
      aria-live="polite"
      title="You’re offline"
      body="Saving is paused until your connection returns. Nothing has been sent."
      className={className}
    />
  );
}

export { Skeleton };
