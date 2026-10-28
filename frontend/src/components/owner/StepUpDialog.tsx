'use client';

import React, { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';

export interface StepUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Resolve on success. Throw to keep the dialog open; `error` is then shown. */
  onSubmit: (code: string) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  /** Message for the last failed attempt (set by the caller from the thrown error). */
  error?: string | null;
}

/**
 * Step-up verification (EX-2): the Owner re-enters a current 6-digit authenticator code before a sensitive
 * action such as a data export. The code is never stored; it is cleared on close.
 */
export function StepUpDialog({
  isOpen,
  onClose,
  onSubmit,
  title = 'Confirm it is you',
  description = 'Enter the 6-digit code from your authenticator app to continue.',
  submitLabel = 'Verify and continue',
  error,
}: StepUpDialogProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /^\d{6}$/.test(code);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit(code);
    } catch {
      /* the caller shows the message through `error` */
    } finally {
      setCode('');
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={busy ? () => undefined : onClose}
      title={title}
      description={description}
      maxWidth="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="step-up-form" isLoading={busy} disabled={!valid || busy}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form id="step-up-form" onSubmit={submit} className="space-y-3">
        <Input
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoFocus
        />
        {error && <Alert tone="danger" title="Could not verify" body={error} />}
      </form>
    </Dialog>
  );
}
