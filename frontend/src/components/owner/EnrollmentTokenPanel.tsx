'use client';

import React, { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Input, Select } from '@/components/ui/Input';
import { StateView } from '@/components/ui/State';
import { ApiError } from '@/lib/api/client';
import { employeesListKey, type EmployeeRow } from '@/lib/api/employees';
import { issueEnrollmentToken, type IssuedEnrollmentToken } from '@/lib/api/identity';
import type { Page } from '@/lib/api/types';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks/useApi';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';

function issueError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'REAUTH_FAILED') return 'Your password or verification code is incorrect.';
    if (err.code === 'TOO_MANY_ATTEMPTS') return 'Too many attempts. Wait a few minutes and try again.';
    if (err.code === 'STATE_CONFLICT') return 'This employee cannot receive an enrollment token (already enrolled, inactive or not an Owner).';
    if (err.status === 403) return 'You are not allowed to issue enrollment tokens.';
    return err.message;
  }
  return 'Something went wrong. Try again.';
}

/**
 * AU-8: an Owner with completed 2FA issues a one-time enrollment token for another active Owner who has not
 * set up two-factor sign-in yet. The token is displayed once and handed over outside the app.
 */
export function EnrollmentTokenPanel() {
  const { user } = useAuth();
  const time = useCompanyTime();
  const query = { role: 'owner' as const, status: 'active' as const, pageSize: 100 };
  const owners = useApi<Page<EmployeeRow>>(employeesListKey(query), { refreshInterval: 0 });
  const eligible = (owners.data?.items ?? []).filter((e) => e.id !== user?.id && !e.twoFactorEnrolled);

  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ token: IssuedEnrollmentToken; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setOpen(false);
    setEmployeeId('');
    setPassword('');
    setCode('');
    setError(null);
    setIssued(null);
    setCopied(false);
  };

  const canSubmit = Boolean(employeeId) && password.length > 0 && /^\d{6}$/.test(code) && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const token = await issueEnrollmentToken({ employeeId, currentPassword: password, token: code });
      setIssued({ token, name: eligible.find((o) => o.id === employeeId)?.fullName ?? 'the Owner' });
      void owners.mutate();
    } catch (err) {
      setError(issueError(err));
    } finally {
      setPassword('');
      setCode('');
      setBusy(false);
    }
  }

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token.enrollmentToken);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="font-semibold text-sm text-text-primary">Enroll another Owner</div>
        <p className="text-xs text-text-secondary mt-0.5">
          A new Owner cannot sign in until they set up two-factor sign-in. Issue a one-time enrollment token and give it to them in person or by a trusted channel.
        </p>
      </div>
      {owners.error ? (
        <Alert tone="warning" title="Could not load Owners" body="Try again in a moment." />
      ) : owners.data && eligible.length === 0 ? (
        <StateView type="empty" size="inline" title="No Owner is waiting" body="Every active Owner has already set up two-factor sign-in." />
      ) : (
        <Button variant="secondary" leadingIcon={<Icon name="lock" size={16} />} disabled={!owners.data} onClick={() => setOpen(true)}>
          Issue enrollment token
        </Button>
      )}

      <Dialog
        isOpen={open}
        onClose={busy ? () => undefined : reset}
        title={issued ? 'Enrollment token' : 'Issue enrollment token'}
        description={issued ? undefined : 'Confirm with your own password and a current authenticator code.'}
        maxWidth="md"
        footer={
          issued ? (
            <div className="flex justify-end">
              <Button onClick={reset}>Done</Button>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={reset} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" form="enrollment-token-form" isLoading={busy} disabled={!canSubmit}>
                Issue token
              </Button>
            </div>
          )
        }
      >
        {issued ? (
          <div className="space-y-3">
            <Alert
              tone="warning"
              title="Shown once"
              body={`Copy it now and give it to ${issued.name}. It expires ${time.format(issued.token.expiresAt)} and cannot be shown again.`}
            />
            <div className="flex items-end gap-2">
              <Input label="Enrollment token" readOnly value={issued.token.enrollmentToken} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="secondary" onClick={() => void copy()}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        ) : (
          <form id="enrollment-token-form" onSubmit={submit} className="space-y-3">
            <Select
              label="Owner to enroll"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Choose an Owner"
              required
              options={eligible.map((o) => ({ value: o.id, label: `${o.fullName} (${o.email})` }))}
            />
            <Input label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Input
              label="Your verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
            {error && <Alert tone="danger" title="Could not issue the token" body={error} role="alert" />}
          </form>
        )}
      </Dialog>
    </div>
  );
}
