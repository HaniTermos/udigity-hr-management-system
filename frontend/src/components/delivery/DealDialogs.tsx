'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { DateInput, Input, Textarea } from '@/components/ui/Input';
import { NoticePolicy } from '@/components/ui/NoticePolicy';
import { useVersionedSave } from '@/lib/hooks/useVersionedSave';
import { runDealCommand, type Deal, type DealFactKey, type DealVerb } from '@/lib/api/deals';
import { ActionError, DEAL_STAGE_LABEL, fieldMessage, fmtDate, todayInput } from './shared';

/** One dialog per deal command. Buttons come from `deal.allowed`; the server re-checks every command. */
export type DealAction =
  | { kind: 'signature' }
  | { kind: 'payment' }
  | { kind: 'remove-fact'; fact: DealFactKey }
  | { kind: 'closure-request' }
  | { kind: 'closure-verify' }
  | { kind: 'closure-reject' }
  | { kind: 'finalize' }
  | { kind: 'not-proceeding' }
  | { kind: 'reopen' };

/** The fields compared on a 409 (SCR-SHR-014). */
export const DEAL_CONFLICT_LABELS = [
  { key: 'stage', label: 'Stage' },
  { key: 'signature', label: 'Signature' },
  { key: 'payment', label: 'Payment' },
  { key: 'closure', label: 'Closure' },
];

export function describeDeal(d: Deal): Record<string, string> {
  const sig = d.facts.signature;
  const pay = d.facts.payment;
  return {
    stage: DEAL_STAGE_LABEL[d.stage],
    signature: sig ? `${fmtDate(sig.date)} · ${sig.reference}` : 'Not recorded',
    payment: pay ? `${fmtDate(pay.date)} · ${pay.reference}${pay.amount ? ` · ${pay.amount} ${pay.currency ?? ''}` : ''}` : 'Not recorded',
    closure: d.closure ? `Closed ${fmtDate(d.closure.closedAt)}` : d.openClosureReview ? 'Verification requested' : 'Not closed',
  };
}

interface Copy {
  title: string;
  description: string;
  confirm: string;
  destructive?: boolean;
}

function copyFor(a: DealAction): Copy {
  switch (a.kind) {
    case 'signature':
      return { title: 'Record signature', description: 'The agreement was signed. Accepted, signed, paid and closed are separate facts; the order does not matter.', confirm: 'Record signature' };
    case 'payment':
      return { title: 'Record payment', description: 'A payment or deposit was received. No attachment is required (DEC-018 pending).', confirm: 'Record payment' };
    case 'remove-fact':
      return {
        title: a.fact === 'signature' ? 'Remove recorded signature' : 'Remove recorded payment',
        description: 'Owner only. The deal returns to its previous stage; the removed values stay in the deal history.',
        confirm: 'Remove fact',
        destructive: true,
      };
    case 'closure-request':
      return { title: 'Request closure verification', description: 'The Owner verifies the signature and payment, then closes the deal.', confirm: 'Request verification' };
    case 'closure-verify':
      return { title: 'Verify and close deal', description: 'Verifies the recorded facts and closes the deal in one step. A closed deal cannot be reopened.', confirm: 'Verify and close' };
    case 'closure-reject':
      return { title: 'Reject closure verification', description: 'The deal stays Signed and paid. The developer sees your reason and can request again.', confirm: 'Reject verification', destructive: true };
    case 'finalize':
      return { title: 'Finalize closure', description: 'Closes the deal. A closed deal cannot be reopened; repeat business is a new deal.', confirm: 'Finalize closure' };
    case 'not-proceeding':
      return { title: 'Mark deal as not proceeding', description: 'A reason is required and is recorded in the deal history. Scheduled meetings are cancelled.', confirm: 'Mark not proceeding', destructive: true };
    case 'reopen':
      return { title: 'Reopen deal', description: 'Owner only. The deal returns to Accepted opportunity; signature and payment must be recorded again.', confirm: 'Reopen deal' };
  }
}

const VERB: Record<DealAction['kind'], DealVerb> = {
  signature: 'signature',
  payment: 'payment',
  'remove-fact': 'remove-fact',
  'closure-request': 'closure-request',
  'closure-verify': 'closure-verify',
  'closure-reject': 'closure-reject',
  finalize: 'finalize',
  'not-proceeding': 'not-proceeding',
  reopen: 'reopen',
};

const TOAST: Record<DealAction['kind'], string> = {
  signature: 'Signature recorded',
  payment: 'Payment recorded',
  'remove-fact': 'Fact removed',
  'closure-request': 'Closure verification requested',
  'closure-verify': 'Deal closed',
  'closure-reject': 'Closure verification rejected',
  finalize: 'Deal closed',
  'not-proceeding': 'Deal marked not proceeding',
  reopen: 'Deal reopened',
};

interface SendInput {
  verb: DealVerb;
  body: Record<string, unknown>;
  /** What this attempt would change, for the conflict view. */
  mine: Record<string, string>;
}

export function DealActionDialog({
  deal,
  action,
  hidden,
  onClose,
  onDone,
  onConflict,
}: {
  deal: Deal;
  action: DealAction;
  /** True while a 409 comparison is shown instead of the dialog; the typed text is kept. */
  hidden?: boolean;
  onClose: () => void;
  onDone: (deal: Deal, message: string) => void;
  onConflict: (mine: Record<string, string>) => void;
}) {
  const copy = copyFor(action);
  const needsReason = action.kind === 'remove-fact' || action.kind === 'closure-reject' || action.kind === 'not-proceeding' || action.kind === 'reopen';
  const [date, setDate] = useState(todayInput());
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [text, setText] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});

  const { status, conflict, fieldErrors, error, route, save, retry } = useVersionedSave<SendInput, Deal>(
    (input, ctx) =>
      runDealCommand(deal.id, input.verb, { ...input.body, version: ctx.version } as never, ctx.idempotencyKey),
    { onSaved: (d) => onDone(d, TOAST[action.kind]) }
  );

  const reported = useRef<unknown>(null);
  useEffect(() => {
    if (conflict && reported.current !== conflict) {
      reported.current = conflict;
      onConflict(conflict.attempted.mine);
    }
  }, [conflict, onConflict]);

  function submit() {
    const next: Record<string, string> = {};
    const body: Record<string, unknown> = {};
    let mine: Record<string, string> = {};
    if (action.kind === 'signature' || action.kind === 'payment') {
      if (!date) next.date = 'Choose the date.';
      if (!reference.trim()) next.reference = action.kind === 'signature' ? 'Add the agreement reference.' : 'Add the payment reference.';
      body.date = date;
      body.reference = reference.trim();
      if (action.kind === 'payment' && (amount.trim() || currency.trim())) {
        const n = Number(amount);
        if (!amount.trim() || !Number.isFinite(n) || n < 0) next.amount = 'Enter the amount, or clear both amount and currency.';
        if (!/^[A-Za-z]{3}$/.test(currency.trim())) next.currency = 'Use a 3-letter currency code, e.g. USD.';
        body.amount = n;
        body.currency = currency.trim().toUpperCase();
      }
      mine =
        action.kind === 'signature'
          ? { signature: `${fmtDate(date)} · ${reference.trim()}` }
          : { payment: `${fmtDate(date)} · ${reference.trim()}${body.amount !== undefined ? ` · ${amount} ${currency.trim().toUpperCase()}` : ''}` };
    }
    if (needsReason) {
      const r = text.trim();
      if (r.length < 3) next.reason = 'A reason of at least 3 characters is required.';
      body.reason = r;
    }
    if (action.kind === 'remove-fact') {
      body.fact = action.fact;
      mine = { [action.fact]: 'Removed' };
    }
    if (action.kind === 'closure-request' && text.trim()) body.note = text.trim();
    if (action.kind === 'closure-request') mine = { closure: 'Verification requested' };
    if (action.kind === 'closure-verify' || action.kind === 'finalize') mine = { stage: DEAL_STAGE_LABEL.closed, closure: 'Closed' };
    if (action.kind === 'not-proceeding') mine = { stage: DEAL_STAGE_LABEL.not_proceeding };
    if (action.kind === 'reopen') mine = { stage: DEAL_STAGE_LABEL.accepted_opportunity };
    setLocal(next);
    if (Object.keys(next).length > 0) return;
    void save({ verb: VERB[action.kind], body, mine }, deal.version);
  }

  const busy = status === 'saving';
  const errs = (key: string, ...alt: string[]) => local[key] ?? fieldMessage(fieldErrors, key, ...alt);
  const closureNotice = action.kind === 'finalize' || action.kind === 'closure-verify' || action.kind === 'closure-request' || action.kind === 'closure-reject';

  return (
    <Dialog
      isOpen={!hidden}
      onClose={busy ? () => undefined : onClose}
      title={copy.title}
      description={`${deal.businessName ?? deal.code} · ${deal.code}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={copy.destructive ? 'destructive' : 'primary'} onClick={submit} isLoading={busy} disabled={busy}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">{copy.description}</p>

        {(action.kind === 'signature' || action.kind === 'payment') && (
          <div className="space-y-3">
            <DateInput label={action.kind === 'signature' ? 'Signature date' : 'Payment date'} required value={date} onChange={(e) => setDate(e.target.value)} error={errs('date')} />
            <Input
              label={action.kind === 'signature' ? 'Agreement reference' : 'Payment reference'}
              required
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              error={errs('reference')}
            />
            {action.kind === 'payment' && (
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Input
                  label="Amount (optional)"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  error={errs('amount')}
                  helperText="Amount and currency go together."
                />
                <Input label="Currency" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} error={errs('currency')} />
              </div>
            )}
          </div>
        )}

        {(needsReason || action.kind === 'closure-request') && (
          <Textarea
            label={needsReason ? 'Reason' : 'Note to the Owner (optional)'}
            required={needsReason}
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={errs('reason', 'note')}
            maxLength={1000}
          />
        )}

        {closureNotice && (
          <NoticePolicy
            tone="policy"
            size="block"
            dec="DEC-006 / R-12"
            demo
            body={`Closure mode: ${deal.policy.closureMode === 'direct' ? 'the assigned Developer finalizes (Alt A)' : 'the Developer requests, the Owner verifies (Alt B)'}.`}
          />
        )}
        {action.kind === 'reopen' && (
          <NoticePolicy tone="policy" size="block" dec="OQ-15" demo body="Reopening a Not proceeding deal is a demonstration flag. Closed deals never reopen." />
        )}

        <ActionError route={route} error={error} onRetry={() => void retry()} />
      </div>
    </Dialog>
  );
}
