import React from 'react';
import { cn } from '@/lib/utils';

/*
 * Figma `Progress/Bar` (51:1916): Tone Brand | Success | Warning | Danger × Percent 0–100.
 * Labels row (Label truncates, Value hugs) + 8 px track on surface/sunken. Width-agnostic, min 80.
 * The Value text states the exact figure; the bar is never the only signal.
 */

export interface ProgressBarProps {
  /** 0–100 */
  percent: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  label?: React.ReactNode;
  value?: React.ReactNode;
  /** Accessible name when no visible label. */
  ariaLabel?: string;
  className?: string;
}

const FILL = {
  brand: 'bg-brand-accent',
  success: 'bg-status-success-solid',
  warning: 'bg-status-warning-solid',
  danger: 'bg-status-danger-solid',
} as const;

export function ProgressBar({ percent, tone = 'brand', label, value, ariaLabel, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <div className={cn('w-full min-w-20 flex flex-col gap-1.5', className)}>
      {(label || value) && (
        <div className="flex items-baseline justify-between gap-3 text-[13px] leading-[18px]">
          {label && <span className="truncate text-text-secondary">{label}</span>}
          {value && <span className="shrink-0 font-medium text-text-primary tabular-nums">{value}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        className="h-2 w-full rounded-full bg-surface-sunken overflow-hidden"
      >
        {pct > 0 && <div className={cn('h-full rounded-full transition-[width] duration-300', FILL[tone])} style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}
