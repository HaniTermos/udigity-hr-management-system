'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Checkbox, Input } from '@/components/ui/Input';
import { NoticePolicy } from '@/components/ui/NoticePolicy';
import { cn } from '@/lib/utils';
import { ENROLLMENT_TOKEN_PATTERN, type EnrollStartInput } from '@/lib/api/identity';
import type { EnrollmentConfirm, EnrollmentStart } from '@/lib/auth';
import { AuthTitle, SessionChip } from './AuthShell';

type Phase = 'connect' | 'confirm' | 'codes';

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'connect', label: 'Connect your second factor' },
  { phase: 'confirm', label: 'Confirm a code' },
  { phase: 'codes', label: 'Save recovery codes' },
];

function StepList({ phase }: { phase: Phase }) {
  const current = STEPS.findIndex((s) => s.phase === phase);
  return (
    <ol className="space-y-2" aria-label="Setup steps">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.phase} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'inline-flex items-center justify-center h-6 px-2 rounded-full border text-xs font-medium shrink-0',
                done && 'bg-status-success-bg border-status-success-border text-status-success-fg',
                active && 'bg-status-brand-bg border-status-brand-border text-status-brand-fg',
                !done && !active && 'bg-status-neutral-bg border-status-neutral-border text-status-neutral-fg'
              )}
            >
              {done ? 'Done' : `Step ${i + 1}`}
            </span>
            <span className={cn('text-sm', active ? 'font-medium text-text-primary' : 'text-text-secondary')}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function groupSecret(secret: string) {
  return secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/** SCR-AUTH-003: forced Owner enrollment (token + password, code, then one-time recovery codes). */
export function EnrollmentFlow({
  startEnrollment,
  confirmEnrollment,
  onFinish,
  onSignOut,
}: {
  startEnrollment: (input: EnrollStartInput) => Promise<EnrollmentStart>;
  confirmEnrollment: (code: string) => Promise<EnrollmentConfirm>;
  /** Called after the codes are acknowledged. */
  onFinish: () => void | Promise<void>;
  onSignOut: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('connect');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ title: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; url?: string } | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const sessionGone = (c?: string) => c === 'SESSION_ENDED' || c === 'UNAUTHENTICATED' || c === 'SESSION_EXPIRED';

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    const tErr = !ENROLLMENT_TOKEN_PATTERN.test(token.trim()) ? 'Enter the 43-character enrollment token you were given.' : null;
    const pErr = !password ? 'Enter your current password.' : null;
    setTokenError(tErr);
    setPasswordError(pErr);
    if (tErr || pErr) return;

    setBusy(true);
    const res = await startEnrollment({ enrollmentToken: token, currentPassword: password });
    setBusy(false);
    if (res.success && res.secret) {
      setSetup({ secret: res.secret, url: res.otpauthUrl });
      setPassword('');
      setPhase('confirm');
      return;
    }
    if (res.code === 'ENROLLMENT_TOKEN_INVALID') {
      setTokenError("This token isn't valid, was already used, or has expired. Ask the operator or another Owner for a new one.");
    } else if (res.code === 'REAUTH_FAILED') {
      setPasswordError('That password is not correct.');
    } else if (res.code === 'TOO_MANY_ATTEMPTS') {
      setAlert({ title: 'Too many attempts', body: 'Wait a few minutes, then try again.' });
    } else if (sessionGone(res.code)) {
      setAlert({ title: 'Your session has ended', body: 'Sign in again to continue setup.' });
    } else {
      setAlert({ title: 'Could not start setup', body: 'Nothing was changed. Try again.' });
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setCodeError("This code doesn't match. Check the time on your device and enter the current code.");
      return;
    }
    setCodeError(null);
    setBusy(true);
    const res = await confirmEnrollment(code);
    setBusy(false);
    if (res.success) {
      setRecoveryCodes(res.recoveryCodes ?? []);
      setToken('');
      setCode('');
      setPhase('codes');
      return;
    }
    if (res.code === 'TOO_MANY_ATTEMPTS' || sessionGone(res.code)) {
      setAlert({ title: 'Your session has ended', body: 'Too many attempts, or the session timed out. Sign in again.' });
      return;
    }
    setCodeError("This code doesn't match. Check the time on your device and enter the current code.");
  };

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setAlert({ title: 'Could not copy', body: 'Select the codes and copy them, or use Download codes.' });
    }
  };

  const downloadCodes = () => {
    const body = [
      'Udigity Management System - recovery codes',
      'Each code works once. Keep this file somewhere safe and private.',
      '',
      ...recoveryCodes,
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'udigity-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const finish = async () => {
    setBusy(true);
    // The codes are dropped from memory before the session refresh navigates away.
    setRecoveryCodes([]);
    await onFinish();
    setBusy(false);
  };

  if (phase === 'codes') {
    return (
      <div className="space-y-4">
        <SessionChip>Pending 2FA enrollment · admin locked</SessionChip>
        <AuthTitle sub="Use one if you lose your second factor. Store them somewhere safe.">Save your recovery codes</AuthTitle>
        <StepList phase="codes" />
        <Alert tone="warning" title="Shown once" body="These codes are not shown again after you leave this page." />

        <div className="rounded-lg border border-border-default bg-surface-subtle p-4">
          {recoveryCodes.length > 0 ? (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-sm text-text-primary select-all" aria-label="Recovery codes">
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">No recovery codes were returned. Ask the operator to reset your second factor.</p>
          )}
          <p className="mt-3 text-xs text-text-muted">Each one works once. {recoveryCodes.length} codes.</p>
        </div>

        {alert && <Alert tone="warning" title={alert.title} body={alert.body} />}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={copyCodes} leadingIcon={<Icon name="copy" size={16} />} disabled={recoveryCodes.length === 0}>
            {copied ? 'Copied' : 'Copy codes'}
          </Button>
          <Button variant="secondary" onClick={downloadCodes} leadingIcon={<Icon name="download" size={16} />} disabled={recoveryCodes.length === 0}>
            {downloaded ? 'Downloaded' : 'Download codes'}
          </Button>
        </div>

        <Checkbox label="I've saved my recovery codes" checked={saved} onChange={(e) => setSaved(e.target.checked)} />

        <Button fullWidth size="lg" disabled={!saved || recoveryCodes.length === 0} isLoading={busy} onClick={finish}>
          Finish setup
        </Button>
        <NoticePolicy tone="decision" dec="Impl. decision" body="Recovery material exists only if the chosen method has it (WF-AUTH-002 E1)." />
      </div>
    );
  }

  if (phase === 'confirm' && setup) {
    return (
      <form onSubmit={confirm} noValidate className="space-y-4" aria-label="Confirm code">
        <SessionChip>Pending 2FA enrollment · admin locked</SessionChip>
        <AuthTitle sub="Owner accounts must use 2FA before any admin access. This step is required.">Set up your second step</AuthTitle>
        <StepList phase="confirm" />

        <div className="rounded-lg border border-dashed border-border-strong p-4 space-y-2 text-center">
          <p className="text-sm font-medium text-text-primary">Setup key</p>
          <p className="font-mono text-sm break-all select-all text-text-primary">{groupSecret(setup.secret)}</p>
          <p className="text-xs text-text-muted">Add this key to an authenticator app (TOTP).</p>
          {setup.url && (
            <a href={setup.url} className="inline-block text-xs font-medium text-text-link hover:underline">
              Open in authenticator app
            </a>
          )}
        </div>

        {alert && <Alert tone="danger" title={alert.title} body={alert.body} />}

        <Input
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000 000"
          autoFocus
          value={code}
          helperText="Enter the current code from your new factor."
          error={codeError ?? undefined}
          className="text-right tracking-widest tabular-nums"
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ''));
            if (codeError) setCodeError(null);
          }}
        />

        <Button type="submit" fullWidth size="lg" isLoading={busy}>
          {busy ? 'Confirming...' : 'Confirm code'}
        </Button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-xs font-medium text-text-link hover:underline"
            onClick={() => {
              setSetup(null);
              setCode('');
              setCodeError(null);
              setAlert(null);
              setPhase('connect');
            }}
          >
            Start setup again
          </button>
          <button type="button" onClick={onSignOut} className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary hover:underline">
            <Icon name="log-out" size={16} />
            Sign out
          </button>
        </div>
        <NoticePolicy tone="decision" dec="Impl. decision" body="After too many failed codes the session ends (threshold is an implementation decision)." />
      </form>
    );
  }

  return (
    <form onSubmit={connect} noValidate className="space-y-4" aria-label="Connect your second factor">
      <SessionChip>Pending 2FA enrollment · admin locked</SessionChip>
      <AuthTitle sub="Owner accounts must use 2FA before any admin access. This step is required.">Set up your second step</AuthTitle>
      <StepList phase="connect" />

      {alert && <Alert tone="danger" title={alert.title} body={alert.body} />}

      <Input
        label="Enrollment token"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="43-character token"
        value={token}
        helperText="Given to you by the operator or another Owner. It works once."
        error={tokenError ?? undefined}
        onChange={(e) => {
          setToken(e.target.value);
          if (tokenError) setTokenError(null);
        }}
      />
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={password}
        helperText="We ask again to confirm it is you."
        error={passwordError ?? undefined}
        onChange={(e) => {
          setPassword(e.target.value);
          if (passwordError) setPasswordError(null);
        }}
      />

      <Button type="submit" fullWidth size="lg" isLoading={busy}>
        {busy ? 'Starting...' : 'Continue'}
      </Button>

      <div className="flex items-center justify-end">
        <button type="button" onClick={onSignOut} className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary hover:underline">
          <Icon name="log-out" size={16} />
          Sign out
        </button>
      </div>

      <div className="space-y-2">
        <NoticePolicy tone="decision" dec="Impl. decision" body="2FA method and recovery channel are implementation decisions; the layout is method-neutral." />
        <NoticePolicy dec="R-11" body="What a pending-2FA Owner may do meanwhile is undecided." />
      </div>
    </form>
  );
}
