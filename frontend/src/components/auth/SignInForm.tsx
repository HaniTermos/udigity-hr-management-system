'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { AuthTitle } from './AuthShell';

export interface SignInValues {
  email: string;
  password: string;
}

/** SCR-AUTH-001. The server decides; wrong credentials and unknown emails get the same message. */
export function SignInForm({
  initialEmail = '',
  initialPassword = '',
  sessionEnded = false,
  isSubmitting,
  error,
  onSubmit,
  children,
}: {
  initialEmail?: string;
  initialPassword?: string;
  sessionEnded?: boolean;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (v: SignInValues) => void;
  /** Dev-only persona picker slot. */
  children?: React.ReactNode;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [show, setShow] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const eErr = !email || !email.includes('@') ? 'Enter a valid email address.' : null;
    const pErr = !password ? 'Enter your password.' : null;
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;
    onSubmit({ email: email.trim(), password });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Sign in">
      <AuthTitle sub="Use your Udigity work email and password.">Sign in</AuthTitle>

      {sessionEnded && !noticeDismissed && (
        <Alert tone="info" title="You were signed out" body="Your session ended. Sign in again to continue. Unsaved input was not kept." />
      )}
      {error && <Alert tone="danger" title="Sign-in failed" body={error} />}

      <Input
        label="Email"
        type="email"
        autoComplete="username"
        placeholder="name@udigity.example"
        leadingIcon="mail"
        value={email}
        error={emailError ?? undefined}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailError) setEmailError(null);
          setNoticeDismissed(true);
        }}
      />

      <Input
        label="Password"
        type={show ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="Your password"
        value={password}
        error={passwordError ?? undefined}
        className="pr-20"
        onChange={(e) => {
          setPassword(e.target.value);
          if (passwordError) setPasswordError(null);
        }}
        trailingElement={
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-pressed={show}
            className="inline-flex items-center gap-1 text-xs font-medium text-text-link hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Icon name={show ? 'eye-off' : 'eye'} size={16} />
            {show ? 'Hide' : 'Show'}
          </button>
        }
      />

      <div className="flex justify-end">
        <Link href="/reset-password" className="text-xs font-medium text-text-link hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>


      {children}
    </form>
  );
}
