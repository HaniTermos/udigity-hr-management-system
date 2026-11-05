'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell, AuthTitle } from '@/components/auth/AuthShell';
import { EnrollmentFlow } from '@/components/auth/EnrollmentFlow';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';

/**
 * Settings → Two-factor authentication (Owner 2026-11-05). An Owner without 2FA lands here after signing in and
 * turns it on: password re-check, QR code, a confirming code, then one-time recovery codes. Until then this is the
 * only page their session may open (backend: pending_2fa_enrollment). A custom-role holder with an Owner-issued
 * token also enrols here, and still enters that token.
 */
export default function TwoFactorSettingsPage() {
  const router = useRouter();
  const { user, isLoading, sessionState, startEnrollment, confirmEnrollment, mutateAuth, logout } = useAuth();

  if (isLoading) {
    return (
      <AuthShell>
        <p className="text-xs text-text-muted">Loading…</p>
      </AuthShell>
    );
  }

  if (sessionState === 'active') {
    return (
      <AuthShell>
        <div className="space-y-4">
          <AuthTitle sub="Your account already asks for a code from your authenticator app when you sign in.">
            Two-factor authentication is on
          </AuthTitle>
          <Link href="/settings">
            <Button fullWidth>Back to Settings</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell wide>
      <EnrollmentFlow
        requireToken={user?.role !== 'owner'}
        startEnrollment={startEnrollment}
        confirmEnrollment={confirmEnrollment}
        onFinish={async () => {
          await mutateAuth();
          router.replace('/settings');
        }}
        onSignOut={() => void logout()}
      />
    </AuthShell>
  );
}
