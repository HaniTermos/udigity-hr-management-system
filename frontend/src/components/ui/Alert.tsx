import React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  body?: string;
  icon?: React.ReactNode;
}

export function Alert({
  className,
  tone = 'info',
  title,
  body,
  icon,
  children,
  ...props
}: AlertProps) {
  const tones = {
    danger: {
      wrapper: 'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] text-[var(--status-danger-fg)]',
      icon: <Icon name="alert-circle" size={18} className="text-[var(--status-danger-fg)]" />,
    },
    warning: {
      wrapper: 'bg-[var(--status-warning-bg)] border-[var(--status-warning-border)] text-[var(--status-warning-fg)]',
      icon: <Icon name="alert-triangle" size={18} className="text-[var(--status-warning-fg)]" />,
    },
    info: {
      wrapper: 'bg-[var(--status-info-bg)] border-[var(--status-info-border)] text-[var(--status-info-fg)]',
      icon: <Icon name="info" size={18} className="text-[var(--status-info-fg)]" />,
    },
    success: {
      wrapper: 'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--status-success-fg)]',
      icon: <Icon name="check-circle" size={18} className="text-[var(--status-success-fg)]" />,
    },
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-lg border text-sm text-left transition-all',
        tones[tone].wrapper,
        className
      )}
      {...props}
    >
      <div className="mt-0.5 shrink-0">{icon || tones[tone].icon}</div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="font-semibold text-sm leading-tight">{title}</div>
        {body && <div className="text-xs opacity-90 leading-relaxed mt-0.5">{body}</div>}
        {children}
      </div>
    </div>
  );
}
