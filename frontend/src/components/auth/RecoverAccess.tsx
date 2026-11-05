'use client';

import React, { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { AuthTitle, SessionChip } from './AuthShell';

/** SCR-AUTH-003 "Recover lost factor": one single-use recovery code (POST /2fa/recover). */
export function RecoverAccess({
  isSubmitting,
  error,
  failed,
  onSubmit,
  onBack,
  onSignOut,
}: {
  isSubmitting: boolean;
  error: string | null;
  /** The session ended (too many attempts or timeout). */
  failed: boolean;
  onSubmit: (code: string) => void;
  onBack: () => void;
  onSignOut: () => void;
}) {
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (failed) {
    return (
      <div className="space-y-4">
        <AuthTitle>Recovery didn&rsquo;t work</AuthTitle>
        <Alert tone="danger" title="Your session has ended." body="The recovery code wasn't accepted. You can sign in and try another code." />
        <Button fullWidth size="lg" onClick={onSignOut}>
          Back to sign in
        </Button>
      </div>
    );
  }

  const shown = localError ?? error;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setLocalError('Enter one of your recovery codes.');
      return;
    }
    setLocalError(null);
    onSubmit(code.trim());
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Recover access">
      <SessionChip>Pending 2FA verification · admin locked</SessionChip>
      <AuthTitle sub="Lost your second factor? Use one of your recovery codes.">Recover access</AuthTitle>

      <Input
        label="Recovery code"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={64}
        placeholder="0000-0000"
        autoFocus
        value={code}
        helperText="Each recovery code works once."
        error={shown ?? undefined}
        onChange={(e) => {
          setCode(e.target.value);
          if (localError) setLocalError(null);
        }}
      />

      <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
        {isSubmitting ? 'Checking...' : 'Use recovery code'}
      </Button>

      <Alert
        tone="info"
        title="What happens next"
        body="Your old factor stops working, all your other sessions are signed out, and you set up 2FA again."
      />

      <div className="flex justify-center">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary hover:underline">
          <Icon name="chevron-left" size={16} />
          Back to code entry
        </button>
      </div>

    </form>
  );
}

/** SCR-AUTH-003 "Recovery used". */
export function RecoveryAccepted({
  remaining,
  total = 10,
  needsReEnrollment,
  onContinue,
}: {
  remaining?: number;
  total?: number;
  /** The session went back to "pending enrollment": the Owner sets up a new factor. */
  needsReEnrollment: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4" role="status">
      <SessionChip>{needsReEnrollment ? 'Pending 2FA enrollment · admin locked' : 'Signed in with a recovery code'}</SessionChip>
      <AuthTitle>Recovery code accepted</AuthTitle>
      <Alert
        tone="success"
        title="Your old factor no longer works."
        body={
          needsReEnrollment
            ? 'All your other sessions were signed out. Set up a new second factor to continue.'
            : 'Ask the operator to reset your second factor so you can set up a new one. Until then, use another recovery code to sign in.'
        }
      />
      {typeof remaining === 'number' && (
        <dl className="flex gap-6 text-sm">
          <dt className="text-text-muted">Recovery codes left</dt>
          <dd className="text-text-primary">
            {remaining} of {total}
          </dd>
        </dl>
      )}
      <Button fullWidth size="lg" onClick={onContinue}>
        {needsReEnrollment ? 'Set up 2FA again' : 'Continue'}
      </Button>
    </div>
  );
}
