import React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/** Exact copy for unresolved policies implemented as config flags (coordination.md rules). */
export const DEMO_ALTERNATIVE_LABEL = 'Demonstration alternative — not approved';
export const POLICY_PENDING_LABEL = 'Policy pending';

const TONE = {
  policy: 'bg-status-policy-bg border-status-policy-border text-status-policy-fg',
  decision: 'bg-status-decision-bg border-status-decision-border text-status-decision-fg',
} as const;

/**
 * Figma `Notice/Policy pending` (44:549): Size Block | Inline | Chip × Tone Policy pending | Implementation decision.
 * Violet = policy pending; navy = implementation decision. Always write the exact ID in `dec`.
 */
export interface NoticePolicyProps {
  tone?: 'policy' | 'decision';
  size?: 'block' | 'inline' | 'chip';
  dec: string; // e.g. "R-11", "DEC-003"
  body?: string;
  /** Show the "Demonstration alternative — not approved" label (policy is running on a demo default). */
  demo?: boolean;
  className?: string;
}

export function NoticePolicy({ tone = 'policy', size = 'block', dec, body, demo = false, className }: NoticePolicyProps) {
  if (size === 'chip') {
    return <PolicyPendingChip dec={dec} demo={demo} tone={tone} className={className} />;
  }
  const label = tone === 'decision' ? 'Implementation decision' : POLICY_PENDING_LABEL;
  if (size === 'inline') {
    return (
      <div
        role="note"
        className={cn('inline-flex flex-wrap items-start gap-x-1.5 gap-y-0.5 rounded-sm border px-2.5 py-1.5', TONE[tone], className)}
      >
        <span className="inline-flex items-center gap-1.5 text-xs leading-4 font-medium">
          <Icon name="hourglass" size={16} className="shrink-0" />
          {dec}
        </span>
        <span className="text-[13px] leading-[18px]">
          {body}
          {demo && <span className="block text-xs leading-4 font-medium">{DEMO_ALTERNATIVE_LABEL}</span>}
        </span>
      </div>
    );
  }
  return (
    <div role="note" className={cn('flex flex-col gap-1.5 rounded-md border px-4 py-3', TONE[tone], className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Icon name="hourglass" size={16} className="shrink-0" />
        <span className="text-xs leading-4 font-medium">{dec}</span>
        <span className="text-sm leading-5 font-medium">{label}</span>
      </div>
      {body && <p className="text-[13px] leading-[18px]">{body}</p>}
      {demo && <p className="text-xs leading-4 font-medium">{DEMO_ALTERNATIVE_LABEL}</p>}
    </div>
  );
}

export function PolicyPendingChip({
  dec,
  label,
  demo = false,
  tone = 'policy',
  className,
}: {
  dec: string;
  label?: string;
  demo?: boolean;
  tone?: 'policy' | 'decision';
  className?: string;
}) {
  const text = demo ? DEMO_ALTERNATIVE_LABEL : (label ?? (tone === 'decision' ? 'Implementation decision' : POLICY_PENDING_LABEL));
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-4 align-middle', TONE[tone], className)}
      title={`${dec}: ${text}`}
    >
      <Icon name="hourglass" size={14} className="shrink-0" />
      <span className="font-medium">{dec}</span>
      <span className="font-normal">{text}</span>
    </span>
  );
}

/** Legacy wireframe badge; renders as the DS policy chip. Prefer `PolicyPendingChip`. */
export function FigmaPolicyBadge({ code, className }: { code: string; className?: string }) {
  return <PolicyPendingChip dec={code} className={className} />;
}

/** Legacy banner API → DS `Banner` tones (info / success / warning / error). */
export function FigmaBanner({
  type = 'info',
  title,
  description,
  onClose,
  className = '',
}: {
  type?: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description: string;
  onClose?: () => void;
  className?: string;
}) {
  const tones = {
    info: { wrap: 'bg-status-info-bg border-status-info-border', fg: 'text-status-info-fg', icon: 'info' as const },
    success: { wrap: 'bg-status-success-bg border-status-success-border', fg: 'text-status-success-fg', icon: 'check-circle' as const },
    warning: { wrap: 'bg-status-warning-bg border-status-warning-border', fg: 'text-status-warning-fg', icon: 'alert-triangle' as const },
    error: { wrap: 'bg-status-danger-bg border-status-danger-border', fg: 'text-status-danger-fg', icon: 'alert-circle' as const },
  }[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn('w-full rounded-lg border p-3 flex items-start justify-between gap-3 text-sm', tones.wrap, className)}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon name={tones.icon} size={20} className={cn('shrink-0', tones.fg)} />
        <div className="min-w-0">
          <div className={cn('font-semibold leading-5', tones.fg)}>{title}</div>
          <div className="text-text-secondary mt-0.5 text-[13px] leading-[18px]">{description}</div>
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 -m-2 w-11 h-11 inline-flex items-center justify-center rounded-md text-icon-muted hover:text-icon-strong hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

/** Callout note with left bar (designer note style). */
export function FigmaCallout({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('border-l-4 border-status-decision-border bg-status-decision-bg text-status-decision-fg rounded-r-md px-3 py-2 text-[13px] leading-[18px]', className)}>
      {children}
    </div>
  );
}
