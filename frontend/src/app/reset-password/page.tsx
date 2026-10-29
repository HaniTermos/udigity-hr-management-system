'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthShell, AuthTitle } from '@/components/auth/AuthShell';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { apiFetch } from '@/lib/api';

/** SHR-015: status 0 means the request was not sent (offline) or the connection dropped. */
const OFFLINE_TEXT = 'You’re offline or the connection dropped. Try again when your connection returns.';

// IMPL-PASSWORD working default mirrored from the backend (PASSWORD_MIN_LENGTH, default 12).
// Demonstration alternative, not approved (docs/policy-defaults.md). The backend is the authority.
const PASSWORD_MIN_LENGTH = Number(process.env.NEXT_PUBLIC_PASSWORD_MIN_LENGTH || 12);

function ShowToggle({ shown, onToggle, label }: { shown: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${shown ? 'Hide' : 'Show'} ${label}`}
      aria-pressed={shown}
      className="flex items-center gap-1.5 px-1 h-8 text-[13px] font-medium text-text-link"
    >
      <Icon name={shown ? 'eye-off' : 'eye'} size={16} />
      {shown ? 'Hide' : 'Show'}
    </button>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  // Read the one-time token once, then take it out of the address bar and history (CR1-25).
  const [token] = useState(() => searchParams.get('token'));
  useEffect(() => {
    if (token !== null && typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
  }, [token]);

  // Reset links carry a 64-hex single-use token (SEQ-02). Anything else cannot work.
  const isTokenMalformed = token !== null && !/^[a-f0-9]{64}$/.test(token);
  const [isLinkRejected, setIsLinkRejected] = useState(false);
  const isTokenExpired = isTokenMalformed || isLinkRejected;

  const [email, setEmail] = useState('');
  const [isQueued, setIsQueued] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);
    setIsSubmitting(true);
    const res = await apiFetch('/api/auth/password-reset/request', { method: 'POST', body: { email } });
    setIsSubmitting(false);
    // Same neutral response for known, unknown and deactivated emails.
    if (res.ok || res.status === 400) {
      setIsQueued(true);
      return;
    }
    setRequestError(res.status === 429 ? 'Too many requests. Please wait and try again.' : res.status === 0 ? OFFLINE_TEXT : 'Something went wrong. Please try again.');
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleError(null);

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setRuleError('Does not meet the password rules.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setRuleError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const res = await apiFetch('/api/auth/password-reset/complete', { method: 'POST', body: { token, newPassword } });
    setIsSubmitting(false);

    if (res.ok) {
      setIsSuccess(true);
      return;
    }
    if (res.error?.code === 'RESET_LINK_INVALID') {
      setIsLinkRejected(true);
      return;
    }
    if (res.status === 400) {
      setRuleError('Does not meet the password rules.');
      return;
    }
    setRuleError(res.status === 429 ? 'Too many attempts. Please wait and try again.' : res.status === 0 ? OFFLINE_TEXT : 'Something went wrong. Please try again.');
  };

  const choosing = token !== null && !isTokenExpired;

  return (
    <AuthShell>
      <div className="space-y-4">
        <AuthTitle sub={choosing ? undefined : 'Enter your work email. If an active account exists, we send a reset link.'}>
          {choosing ? 'Choose a new password' : 'Reset your password'}
        </AuthTitle>

        {token !== null && isTokenExpired && (
          <div className="space-y-3">
            <Alert tone="danger" title="This link no longer works" body="Reset links expire and work once. Request a new link." />
            <Link href="/reset-password" className="inline-flex">
              <span className="inline-flex items-center justify-center h-10 px-4 rounded-lg border border-border-strong text-sm font-medium text-text-primary hover:bg-surface-hover">
                Request new link
              </span>
            </Link>
          </div>
        )}

        {choosing &&
          (isSuccess ? (
            <div className="space-y-4">
              <Alert tone="success" title="Password updated" body="You can now sign in." />
              <Link href="/login" className="inline-flex">
                <span className="inline-flex items-center justify-center h-10 px-4 rounded-lg bg-brand-primary hover:bg-brand-primary-hover text-text-on-primary text-sm font-medium">
                  Go to sign in
                </span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSavePassword} noValidate className="space-y-4" aria-label="Choose a new password">
              <Input
                label="New password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                autoComplete="new-password"
                required
                helperText={`At least ${PASSWORD_MIN_LENGTH} characters`}
                error={ruleError ?? undefined}
                trailingElement={<ShowToggle shown={showNew} onToggle={() => setShowNew((v) => !v)} label="new password" />}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (ruleError) setRuleError(null);
                }}
              />
              <Input
                label="Confirm new password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                autoComplete="new-password"
                required
                trailingElement={<ShowToggle shown={showConfirm} onToggle={() => setShowConfirm((v) => !v)} label="confirm password" />}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (ruleError) setRuleError(null);
                }}
              />
              <Button type="submit" fullWidth isLoading={isSubmitting}>
                Save password
              </Button>
            </form>
          ))}

        {token === null && (
          <div className="space-y-4">
            {isQueued && (
              <Alert
                tone="info"
                title="Reset link queued"
                body="If an active account uses this email, a reset link has been queued for sending. Delivery is not confirmed here."
              />
            )}
            {requestError && <Alert tone="danger" title="Request not sent" body={requestError} />}

            <form onSubmit={handleSendLink} className="space-y-4" aria-label="Request a reset link">
              <Input
                label="Email"
                type="email"
                value={email}
                autoComplete="email"
                placeholder="name@udigity.com"
                required
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" fullWidth isLoading={isSubmitting}>
                Send reset link
              </Button>
              <Link href="/login" className="inline-flex items-center gap-1 text-[13px] font-medium text-text-link hover:underline">
                ‹ Back to sign in
              </Link>
            </form>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface-page">
          <div className="text-xs text-text-muted font-medium">Loading...</div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
