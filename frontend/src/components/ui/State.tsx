import React from 'react';
import { cn } from '@/lib/utils';
import { Icon, IconName } from './Icon';

/*
 * Figma `State`: Type Empty | No results | Loading | Error | Session expired | Save conflict × Size Page (480) | Inline (360).
 * Loading uses skeleton bars, not spinners, for lists. Override title/body per screen.
 * Figma `Skeleton`: Text line | Avatar | Table row | Card (surface/skeleton).
 */

export type StateType = 'empty' | 'no-results' | 'loading' | 'error' | 'session-expired' | 'save-conflict';

const COPY: Record<StateType, { icon: IconName | null; tone: 'neutral' | 'danger' | 'warning'; title: string; body: string }> = {
  empty: { icon: 'folder', tone: 'neutral', title: 'Nothing here yet', body: 'Items you add or are assigned will appear here.' },
  'no-results': { icon: 'search', tone: 'neutral', title: 'No matches', body: 'Try a different search, or clear filters.' },
  loading: { icon: null, tone: 'neutral', title: 'Loading…', body: '' },
  error: { icon: 'alert-circle', tone: 'danger', title: 'Something went wrong', body: 'We could not load this. Your data is safe — try again.' },
  'session-expired': { icon: 'lock', tone: 'warning', title: 'Session expired', body: 'Sign in again to continue. Unsaved changes on this page are kept.' },
  'save-conflict': { icon: 'refresh', tone: 'warning', title: 'Someone else changed this record', body: 'Review the latest version, then re-apply your changes.' },
};

const CIRCLE = {
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
  danger: 'bg-status-danger-bg text-status-danger-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
} as const;

export interface StateViewProps {
  type: StateType;
  size?: 'page' | 'inline';
  title?: string;
  body?: string;
  /** Page: a Button. Inline: a link-style Button. */
  action?: React.ReactNode;
  className?: string;
}

export function StateView({ type, size = 'page', title, body, action, className }: StateViewProps) {
  const c = COPY[type];
  const page = size === 'page';
  const t = title ?? c.title;
  const b = body ?? c.body;

  if (type === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn('w-full flex flex-col gap-2.5', page ? 'max-w-[480px] mx-auto p-8 items-center' : 'max-w-[360px] p-4', className)}
      >
        {(page ? ['w-[416px]', 'w-[360px]', 'w-[300px]'] : ['w-[296px]', 'w-[240px]']).map((w) => (
          <Skeleton key={w} className={cn('h-3 max-w-full', w)} />
        ))}
        <span className="text-xs text-text-muted">{t}</span>
      </div>
    );
  }

  const role = type === 'error' ? 'alert' : 'status';

  if (!page) {
    return (
      <div role={role} className={cn('w-full flex items-start gap-3 p-4 rounded-lg bg-surface-subtle', className)}>
        {c.icon && (
          <span className={cn('w-9 h-9 shrink-0 rounded-full inline-flex items-center justify-center', CIRCLE[c.tone])}>
            <Icon name={c.icon} size={20} />
          </span>
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-1 items-start">
          <p className="text-sm font-medium leading-5 text-text-primary">{t}</p>
          {b && <p className="text-[13px] leading-[18px] text-text-secondary">{b}</p>}
          {action}
        </div>
      </div>
    );
  }

  return (
    <div role={role} className={cn('w-full max-w-[480px] mx-auto flex flex-col items-center gap-3 p-8 text-center', className)}>
      {c.icon && (
        <span className={cn('w-12 h-12 rounded-full inline-flex items-center justify-center', CIRCLE[c.tone])}>
          <Icon name={c.icon} size={24} />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold leading-6 text-text-primary">{t}</h2>
        {b && <p className="text-[13px] leading-[18px] text-text-secondary">{b}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('rounded-sm bg-surface-skeleton animate-pulse', className)} {...props} />;
}

/** Skeleton Type=Table row */
export function SkeletonTableRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-6 px-3 py-5 border-t border-border-subtle bg-surface-default', className)}>
      {['w-4', 'w-[280px]', 'w-40', 'w-24', 'w-[180px]', 'w-20'].map((w) => (
        <Skeleton key={w} className={cn('h-3 shrink', w)} />
      ))}
    </div>
  );
}

/** Skeleton Type=Card */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2.5 p-5 rounded-xl border border-border-default bg-surface-default', className)}>
      <Skeleton className="h-3 w-[120px]" />
      <Skeleton className="h-6 w-[200px] max-w-full" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}
