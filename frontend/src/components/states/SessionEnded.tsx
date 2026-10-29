'use client';

import React from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { cn } from '@/lib/utils';
import type { SessionEndReason } from '@/lib/errorRouting';

/*
 * SCR-SHR-013 Session ended: expired | revoked by Owner | account deactivated | in-app dialog.
 * Idle/absolute lifetimes and unsaved-input handling are implementation decisions, shown with the
 * neutral "Impl. decision" notice (not a policy chip).
 */

const COPY: Record<
  SessionEndReason,
  { icon: IconName; tone: 'warning' | 'danger'; title: string; body: string; action: string; unsaved: boolean }
> = {
  expired: {
    icon: 'lock',
    tone: 'warning',
    title: 'Your session has expired',
    body: 'For your security you were signed out. Sign in again to continue.',
    action: 'Sign in again',
    unsaved: true,
  },
  revoked: {
    icon: 'lock',
    tone: 'warning',
    title: 'You were signed out',
    body: 'Your sessions were ended by the Owner/Admin or after a password or 2FA change. Sign in again to continue.',
    action: 'Sign in again',
    unsaved: false,
  },
  deactivated: {
    icon: 'alert-circle',
    tone: 'danger',
    title: 'Your account is no longer active',
    body: 'You can’t sign in. Contact the Owner/Admin if you think this is a mistake.',
    action: 'Back to sign in',
    unsaved: false,
  },
};

function loginHref(reason: SessionEndReason, redirect?: string): string {
  if (reason === 'deactivated') return '/login';
  const q = new URLSearchParams({ reason: 'session_expired' });
  if (redirect) q.set('redirect', redirect);
  return `/login?${q.toString()}`;
}

export interface SessionEndedCardProps {
  reason: SessionEndReason;
  /** Same-origin path to return to after signing in again. */
  redirect?: string;
  className?: string;
}

/** The card only (reused by the page below). */
export function SessionEndedCard({ reason, redirect, className }: SessionEndedCardProps) {
  const c = COPY[reason];
  const circle = c.tone === 'danger' ? 'bg-status-danger-bg text-status-danger-fg' : 'bg-status-warning-bg text-status-warning-fg';
  return (
    <div className={cn('w-full max-w-[440px] bg-surface-default border border-border-default rounded-xl p-5 flex flex-col gap-4', className)}>
      <div role="alert" className="flex items-start gap-3 p-4 rounded-lg bg-surface-subtle">
        <span className={cn('w-9 h-9 shrink-0 rounded-full inline-flex items-center justify-center', circle)}>
          <Icon name={c.icon} size={20} />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-sm font-medium leading-5 text-text-primary">{c.title}</h1>
          <p className="text-[13px] leading-[18px] text-text-secondary">{c.body}</p>
        </div>
      </div>
      {c.unsaved && (
        <Alert tone="warning" title="Unsaved changes were not kept" body="Anything you hadn’t saved on the previous page could not be saved." />
      )}
      <Link href={loginHref(reason, redirect)} className="block">
        <Button fullWidth size="lg" variant={reason === 'deactivated' ? 'secondary' : 'primary'}>
          {c.action}
        </Button>
      </Link>
    </div>
  );
}

/** Full page: navy brand panel on desktop, card on the page surface. Used by `/session-ended`. */
export function SessionEndedPage({ reason, redirect }: { reason: SessionEndReason; redirect?: string }) {
  return (
    <div className="min-h-screen grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] bg-surface-page text-text-primary">
      <div className="hidden md:flex flex-col justify-between bg-surface-brand text-text-on-brand p-16">
        <BrandLogo surface="on-brand" size="sm" priority />
        <div className="flex flex-col gap-3">
          <p className="ds-h1 text-text-on-brand">Udigity Management System</p>
          <p className="text-sm text-text-on-brand-muted">Attendance, businesses, calls and projects in one place.</p>
        </div>
        <div className="flex flex-col gap-3">
          <span className="block w-12 h-0.5 bg-brand-accent" />
          <p className="text-xs text-text-on-brand-muted">Internal system · authorised Udigity staff only</p>
        </div>
      </div>
      <main className="flex flex-col items-center justify-center gap-4 p-4 sm:p-8">
        <SessionEndedCard reason={reason} redirect={redirect} />
        <p className="text-xs text-text-muted text-center">© 2026 Udigity · Need access? Ask the Owner/Admin.</p>
      </main>
    </div>
  );
}

/** In-app dialog shown over the page when a request returns 401 while the user has unsaved input. */
export function SessionEndedDialog({
  isOpen,
  reason = 'expired',
  redirect,
  unsavedLabel = 'Your unsaved changes were not saved',
  onClose,
}: {
  isOpen: boolean;
  reason?: SessionEndReason;
  redirect?: string;
  unsavedLabel?: string;
  onClose: () => void;
}) {
  const c = COPY[reason];
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={c.title}
      description="Sign in again to continue."
      maxWidth="md"
      footer={
        <Link href={loginHref(reason, redirect)}>
          <Button>{c.action}</Button>
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        <Alert tone="warning" title={unsavedLabel} body="Copy it somewhere before signing in if you still need it." />
      </div>
    </Dialog>
  );
}
