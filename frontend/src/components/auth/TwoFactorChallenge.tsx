'use client';

import React, { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { AuthTitle, SessionChip } from './AuthShell';

/** SCR-AUTH-002: the 6-digit code from the Owner's second factor. */
export function TwoFactorChallenge({
  email,
  isSubmitting,
  error,
  lockedOut,
  verified,
  onVerify,
  onRecover,
  onSignOut,
}: {
  email?: string;
  isSubmitting: boolean;
  error: string | null;
  lockedOut: boolean;
  verified: boolean;
  onVerify: (code: string) => void;
  onRecover: () => void;
  onSignOut: () => void;
}) {
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (lockedOut) {
    return (
      <div className="space-y-4">
        <AuthTitle>Verification failed</AuthTitle>
        <Alert tone="danger" title="Your session has ended" body="Too many attempts, or the session timed out. Sign in again." />
        <Button fullWidth size="lg" onClick={onSignOut}>
          Back to sign in
        </Button>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="space-y-4" role="status">
        <AuthTitle>Verified</AuthTitle>
        <Alert tone="success" title="Verified. Welcome back." body="Your session is active. Taking you to your home page." />
      </div>
    );
  }

  const shown = localError ?? error;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setLocalError('Code is incorrect or expired. Try again.');
      return;
    }
    setLocalError(null);
    onVerify(code.trim());
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Two-step verification">
      <SessionChip>Pending 2FA · admin locked</SessionChip>
      <AuthTitle sub={email ? `Enter the code from your second factor for ${email}.` : 'Enter the code from your second factor.'}>
        Confirm it&rsquo;s you
      </AuthTitle>

      <Input
        label="Verification code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000 000"
        autoFocus
        value={code}
        helperText="Enter the current code. It changes regularly."
        error={shown ?? undefined}
        className="text-right tracking-widest tabular-nums"
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, ''));
          if (localError) setLocalError(null);
        }}
      />

      <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
        {isSubmitting ? 'Verifying...' : 'Verify'}
      </Button>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onRecover} className="text-xs font-medium text-text-link hover:underline">
          Lost your second factor?
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary hover:underline"
        >
          <Icon name="log-out" size={16} />
          Sign out
        </button>
      </div>

    </form>
  );
}
