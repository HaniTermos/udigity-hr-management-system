'use client';

import React from 'react';
import Link from 'next/link';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/*
 * SCR-SHR-012 Record hidden by policy. The copy is identical for "hidden" and "does not exist", and no
 * record data, name or count is shown (leakage control, plan.md §5).
 * `showPolicyChips` adds the pending-policy chips from the approved preview (DEC-001/002/003 and the
 * "Request access" note). They are demonstration markers only: production UI shows no decision IDs.
 */

export interface HiddenByPolicyProps {
  /** `stale` = arrived from a notification or calendar entry whose access has since changed. */
  variant?: 'direct' | 'stale';
  backHref: string;
  backLabel: string;
  showPolicyChips?: boolean;
  className?: string;
}

export function HiddenByPolicy({ variant = 'direct', backHref, backLabel, className }: HiddenByPolicyProps) {
  return (
    <div className={cn('w-full flex flex-col gap-6', className)}>
      {variant === 'stale' && (
        <Alert
          tone="info"
          title="Opened from a notification or calendar event"
          body="Access changed after it was created, so the record can’t be shown."
        />
      )}
      <div className="flex flex-col items-center gap-6 py-10">
        <NoticeAccess
          type="hidden-by-policy"
          size="page"
          title="This record isn’t available to you"
          body="It is outside what your role can see, so no details are shown."
          action={
            <Link href={backHref}>
              <Button variant="secondary">{backLabel}</Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}
