import React from 'react';
import { cn } from '@/lib/utils';
import { Icon, IconName } from './Icon';

/*
 * Figma `Notice/Access`: Type Permission denied | Hidden by policy | Context-limited × Size Page | Inline.
 * Never reveals hidden data. Context-limited keeps the DEC-005 policy chip visible.
 */

export type AccessType = 'permission-denied' | 'hidden-by-policy' | 'context-limited';

const COPY: Record<AccessType, { icon: IconName; title: string; body: string }> = {
  'permission-denied': {
    icon: 'lock',
    title: 'You do not have access to this page',
    body: 'Your role cannot open this screen. If you need access, ask the Owner/Admin.',
  },
  'hidden-by-policy': {
    icon: 'eye-off',
    title: 'This record is not visible to you',
    body: 'It exists, but the visibility policy hides it from your role. No details are shown.',
  },
  'context-limited': {
    icon: 'shield',
    title: 'Limited business context',
    body: 'You see only the business details needed for this deal or project.',
  },
};

export interface NoticeAccessProps {
  type: AccessType;
  size?: 'page' | 'inline';
  title?: string;
  body?: string;
  /** Page size only: e.g. a secondary Button "Go to My Day". */
  action?: React.ReactNode;
  className?: string;
}

export function NoticeAccess({ type, size = 'page', title, body, action, className }: NoticeAccessProps) {
  const c = COPY[type];

  if (size === 'inline') {
    return (
      <div
        role="note"
        className={cn('w-full flex items-start gap-3 px-3 py-2.5 rounded-md border bg-status-neutral-bg border-status-neutral-border', className)}
      >
        <Icon name={c.icon} size={20} className="shrink-0 text-status-neutral-fg" />
        <div className="flex-1 min-w-0 flex flex-col gap-1 items-start">
          <p className="text-sm font-medium leading-5 text-text-primary">{title ?? c.title}</p>
          <p className="text-[13px] leading-[18px] text-text-secondary">{body ?? c.body}</p>
        </div>
      </div>
    );
  }

  return (
    <div role="note" className={cn('w-full max-w-[480px] mx-auto flex flex-col items-center gap-3 p-8 text-center', className)}>
      <span className="w-12 h-12 rounded-full bg-status-neutral-bg inline-flex items-center justify-center">
        <Icon name={c.icon} size={24} className="text-status-neutral-fg" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold leading-6 text-text-primary">{title ?? c.title}</h2>
        <p className="text-[13px] leading-[18px] text-text-secondary">{body ?? c.body}</p>
      </div>
      {action}
    </div>
  );
}
