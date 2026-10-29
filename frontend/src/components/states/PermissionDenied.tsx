'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

/*
 * SCR-SHR-011 Permission denied. Never reveals data: the copy only names the user's own role and the
 * area they tried to open (a label the caller supplies, never a record).
 * Variants: `role` (page, in the app shell) and `owner-2fa` (Owner without completed 2FA).
 */

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner/Admin',
  data_entry: 'Data Entry',
  call_center: 'Call Center',
  developer: 'Developer',
};

export interface PermissionDeniedProps {
  variant?: 'role' | 'owner-2fa';
  /** Name of the screen or area, e.g. "Reports & Exports". */
  area?: string;
  className?: string;
}

export function PermissionDenied({ variant = 'role', area, className }: PermissionDeniedProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  if (variant === 'owner-2fa') {
    return (
      <div className={cn('w-full max-w-[420px] mx-auto bg-surface-default border border-border-default rounded-2xl p-6 flex flex-col gap-4', className)}>
        <Badge tone="warning" hasDot size="sm" className="self-start">
          Pending 2FA · admin locked
        </Badge>
        <div className="flex flex-col gap-2">
          <h1 className="ds-h3 text-text-primary">Finish the second step first</h1>
          <p className="text-sm leading-5 text-text-secondary">
            Admin pages open only after 2FA is complete. You will return to the verification step.
          </p>
        </div>
        <Link href="/login?step=2fa" className="block">
          <Button fullWidth size="lg">
            Continue to 2FA
          </Button>
        </Link>
        <Button variant="ghost" fullWidth leadingIcon={<Icon name="log-out" size={16} />} onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
    );
  }

  const roleLabel = user ? ROLE_LABEL[user.role] ?? 'your role' : 'your role';
  const body = area
    ? `Your role (${roleLabel}) can't open ${area}. If you need it, ask the Owner/Admin.`
    : `Your role (${roleLabel}) can't open this page. If you need it, ask the Owner/Admin.`;

  return (
    <div className={cn('w-full flex flex-col items-center gap-4 py-16', className)}>
      <NoticeAccess
        type="permission-denied"
        size="page"
        title="You don’t have access to this page"
        body={body}
        action={
          <Link href="/my-day">
            <Button variant="secondary">Go to My Day</Button>
          </Link>
        }
      />
      <Button variant="ghost" leadingIcon={<Icon name="chevron-left" size={16} />} onClick={() => router.back()}>
        Back
      </Button>
    </div>
  );
}
