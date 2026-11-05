import React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

export interface PolicyTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  code: string;
  label?: string;
  compact?: boolean;
}

/** Compact policy reference (violet policy tone). Prefer `PolicyPendingChip` from NoticePolicy for new code. */
export function PolicyTag({ className, code, label, compact = false, ...props }: PolicyTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs leading-4 border bg-status-policy-bg border-status-policy-border text-status-policy-fg select-none',
        className
      )}
      title={label ? `${code}: ${label}` : code}
      {...props}
    >
      <Icon name="hourglass" size={12} className="shrink-0" />
      <span className="font-semibold">{code}</span>
      {!compact && label && <span className="truncate max-w-[200px]">{label}</span>}
    </span>
  );
}
