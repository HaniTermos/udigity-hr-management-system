import React from 'react';
import { cn } from '@/lib/utils';
import { Icon, IconName } from './Icon';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'policy' | 'decision';
export type OutcomeType = 'Pending' | 'On hold' | 'Needs another call' | 'Rejected' | 'Accepted';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  hasDot?: boolean;
  size?: 'sm' | 'md';
  derived?: boolean; // dashed border for derived facts
  icon?: IconName;
}

export function Badge({
  className,
  tone = 'neutral',
  hasDot = false,
  size = 'sm',
  derived = false,
  icon,
  children,
  ...props
}: BadgeProps) {
  const tones = {
    neutral: 'bg-status-neutral-bg text-status-neutral-fg border-status-neutral-border',
    success: 'bg-status-success-bg text-status-success-fg border-status-success-border',
    warning: 'bg-status-warning-bg text-status-warning-fg border-status-warning-border',
    danger: 'bg-status-danger-bg text-status-danger-fg border-status-danger-border',
    info: 'bg-status-info-bg text-status-info-fg border-status-info-border',
    brand: 'bg-status-brand-bg text-status-brand-fg border-status-brand-border',
    policy: 'bg-status-policy-bg text-status-policy-fg border-status-policy-border',
    decision: 'bg-status-decision-bg text-status-decision-fg border-status-decision-border',
  };

  const dotColors = {
    neutral: 'bg-status-neutral-solid',
    success: 'bg-status-success-solid',
    warning: 'bg-status-warning-solid',
    danger: 'bg-status-danger-solid',
    info: 'bg-status-info-solid',
    brand: 'bg-status-brand-solid',
    policy: 'bg-status-policy-solid',
    decision: 'bg-status-decision-solid',
  };

  const sizes = {
    sm: 'py-0.5 text-xs leading-4 px-2 gap-1', // Badge/Status Small · ds/Label Small
    md: 'py-1 text-xs leading-4 px-2.5 gap-1.5', // Badge/Status Large
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium select-none max-w-full',
        derived ? 'border border-dashed' : 'border',
        tones[tone],
        sizes[size],
        className
      )}
      {...props}
    >
      {hasDot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[tone])} />}
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} className="shrink-0" />}
      <span className="leading-4">{children}</span>
    </span>
  );
}

/** Figma `Badge/Count` (Neutral | Brand | Danger | On brand). */
export function CountBadge({
  count,
  tone = 'neutral',
  className,
}: {
  count: number | string;
  tone?: 'neutral' | 'brand' | 'danger' | 'on-brand';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-status-neutral-bg text-status-neutral-fg',
    brand: 'bg-status-brand-solid text-text-on-primary',
    danger: 'bg-status-danger-solid text-text-on-danger',
    'on-brand': 'bg-surface-brand-active text-text-on-brand',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold tabular-nums leading-none',
        tones[tone],
        className
      )}
    >
      {count}
    </span>
  );
}

/** Figma `Tag` (Neutral | Brand | Outline): category, phone label, platform. Not a status. */
export function Tag({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: 'neutral' | 'brand' | 'outline';
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: 'bg-surface-sunken text-text-secondary border-transparent',
    brand: 'bg-brand-accent-subtle text-brand-accent-strong border-transparent',
    outline: 'bg-transparent text-text-secondary border-border-strong',
  };
  return (
    <span className={cn('inline-flex items-center h-6 px-2 rounded-sm border text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}

/** Figma `Chip/Derived` (Neutral | Amber): dashed border = derived, not stored. */
export function DerivedChip({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: 'neutral' | 'amber';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge tone={tone === 'amber' ? 'warning' : 'neutral'} derived className={className}>
      {children}
    </Badge>
  );
}

export function OutcomeBadge({ outcome, className }: { outcome: OutcomeType; className?: string }) {
  switch (outcome) {
    case 'Accepted':
      return (
        <Badge tone="success" icon="check-circle" className={className}>
          Accepted
        </Badge>
      );
    case 'Rejected':
      return (
        <Badge tone="danger" icon="x-circle" className={className}>
          Rejected
        </Badge>
      );
    case 'Needs another call':
      return (
        <Badge tone="warning" icon="phone" className={className}>
          Needs another call
        </Badge>
      );
    case 'On hold':
      return (
        <Badge tone="neutral" icon="pause-circle" className={className}>
          On hold
        </Badge>
      );
    case 'Pending':
    default:
      return (
        <Badge tone="info" icon="clock" className={className}>
          Pending
        </Badge>
      );
  }
}
