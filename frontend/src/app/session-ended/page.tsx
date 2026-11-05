'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SessionEndedPage } from '@/components/states/SessionEnded';
import { parseSessionEndReason } from '@/lib/errorRouting';
import { safeRedirectTarget } from '@/lib/authRoutes';

// SCR-SHR-013. Public: the session is gone, so this page never calls the API.
function SessionEndedContent() {
  const params = useSearchParams();
  const reason = parseSessionEndReason(params.get('reason'));
  const redirect = params.get('redirect');
  const safe = redirect ? safeRedirectTarget(redirect, '') : '';
  return <SessionEndedPage reason={reason} redirect={safe || undefined} />;
}

export default function SessionEndedRoute() {
  return (
    <Suspense fallback={null}>
      <SessionEndedContent />
    </Suspense>
  );
}
