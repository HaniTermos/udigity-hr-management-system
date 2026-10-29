'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { DateInput, Input, Textarea } from '@/components/ui/Input';
import { NoticePolicy } from '@/components/ui/NoticePolicy';
import { useVersionedSave } from '@/lib/hooks/useVersionedSave';
import { runDealCommand, type Deal, type DealAdvanceTarget, type DealFactKey, type DealVerb } from '@/lib/api/deals';
import { ActionError, DEAL_STAGE_LABEL, fieldMessage, fmtDate, todayInput } from './shared';

/** One dialog per deal command. Buttons come from `deal.allowed`; the server re-checks every command. */
export type DealAction =
  | { kind: 'advance-stage'; to: DealAdvanceTarget }
  | { kind: 'contract' }
  | { kind: 'financial-correction' }
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
  { key: 'contract', label: 'Contract amount' },
  { key: 'closure', label: 'Closure' },
];

/** Amount text; a missing amount reads "Not recorded", never 0 (D16). */
export function moneyText(amount: string | null, currency: string | null): string {
  return amount === null ? 'Not recorded' : `${amount} ${currency ?? ''}`.trim();
}

export function describeDeal(d: Deal): Record<string, string> {
  const sig = d.facts.signature;
  const pay = d.facts.payment;
  return {
    stage: DEAL_STAGE_LABEL[d.stage],
    signature: sig ? [sig.reference ?? 'No agreement reference', sig.date ? fmtDate(sig.date) : null].filter(Boolean).join(' · ') : 'Not recorded',
    payment: pay ? [fmtDate(pay.date), pay.reference, pay.amount !== null ? moneyText(pay.amount, pay.currency) : null].filter(Boolean).join(' · ') : 'Not recorded',
    contract: moneyText(d.contract.amount, d.contract.currency),
    closure: d.closure ? `Verified closed ${fmtDate(d.closure.closedAt)}` : d.openClosureReview ? 'Payment pending verification' : 'Not closed',
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
    case 'advance-stage':
      return {
        title: a.to === 'meeting_scheduled' ? 'Mark meeting scheduled' : 'Mark proposal sent',
        description: 'Stages move forward only; later stages may be skipped. The move is recorded in the deal history.',
        confirm: a.to === 'meeting_scheduled' ? 'Mark meeting scheduled' : 'Mark proposal sent',
      };
    case 'contract':
      return {
        title: 'Contract amount',
        description: 'The agreed contract amount, separate from payments received. Optional; a currency is required with an amount. Leave both empty to clear it.',
        confirm: 'Save contract amount',
      };
    case 'financial-correction':
      return {
        title: 'Correct financial facts',
        description: 'Owner only. Changes the verified financial facts of this closed deal. A reason is required; the previous values stay in the deal history.',
        confirm: 'Save correction',
      };
    case 'signature':
      return { title: 'Record signature', description: 'The agreement was signed. The agreement reference is required for closure; the signature date is optional.', confirm: 'Record signature' };
    case 'payment':
      return { title: 'Record payment', description: 'A first payment or deposit was received. The payment date is required for closure; reference and amount are optional. No attachment is required.', confirm: 'Record payment' };
    case 'remove-fact':
      return {
        title: a.fact === 'signature' ? 'Remove recorded signature' : 'Remove recorded payment',
        description: 'Owner only. The deal returns to its previous stage; the removed values stay in the deal history.',
        confirm: 'Remove fact',
        destructive: true,
      };
    case 'closure-request':
      return { title: 'Submit payment received', description: 'Sends the payment for Owner verification. Only the Owner’s verification closes the deal.', confirm: 'Submit for verification' };
    case 'closure-verify':
      return { title: 'Verify and close deal', description: 'Verifies the agreement reference and payment date and closes the deal in one step. A closed deal cannot be reopened.', confirm: 'Verify and close' };
    case 'closure-reject':
      return { title: 'Reject payment verification', description: 'The deal stays open. The developer sees your reason and can submit again.', confirm: 'Reject verification', destructive: true };
    case 'finalize':
      return { title: 'Verify and close deal', description: 'Owner only: records and verifies the closure directly. A closed deal cannot be reopened; repeat business is a new deal.', confirm: 'Verify and close' };
    case 'not-proceeding':
      return { title: 'Mark deal as lost', description: 'A reason is required and is recorded in the deal history. Scheduled meetings are cancelled.', confirm: 'Mark lost', destructive: true };
    case 'reopen':
      return { title: 'Reopen deal', description: 'Owner only. The deal returns to Accepted; signature and payment must be recorded again.', confirm: 'Reopen deal' };
  }
}

const VERB: Record<DealAction['kind'], DealVerb> = {
  'advance-stage': 'advance-stage',
  contract: 'contract',
  'financial-correction': 'financial-correction',
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
  'advance-stage': 'Stage updated',
  contract: 'Contract amount saved',
  'financial-correction': 'Financial facts corrected',
  signature: 'Signature recorded',
  payment: 'Payment recorded',
  'remove-fact': 'Fact removed',
  'closure-request': 'Payment submitted for verification',
  'closure-verify': 'Deal verified and closed',
  'closure-reject': 'Payment verification rejected',
  finalize: 'Deal verified and closed',
  'not-proceeding': 'Deal marked lost',
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
  const correcting = action.kind === 'financial-correction';
  const needsReason =
    action.kind === 'remove-fact' || action.kind === 'closure-reject' || action.kind === 'not-proceeding' || action.kind === 'reopen' || correcting;
  const sig = deal.facts.signature;
  const pay = deal.facts.payment;
  const [date, setDate] = useState(action.kind === 'signature' ? '' : todayInput());
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState(action.kind === 'contract' ? (deal.contract.amount ?? '') : '');
  const [currency, setCurrency] = useState(action.kind === 'contract' ? (deal.contract.currency ?? '') : '');
  // Financial correction: prefilled with the verified values; only changed fields are sent.
  const initial = {
    agreementReference: sig?.reference ?? '',
    signatureDate: sig?.date ?? '',
    paymentDate: pay?.date ?? '',
    paymentReference: pay?.reference ?? '',
    paymentAmount: pay?.amount ?? '',
    paymentCurrency: pay?.currency ?? '',
    contractAmount: deal.contract.amount ?? '',
    contractCurrency: deal.contract.currency ?? '',
  };
  const [fix, setFix] = useState(initial);
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

  /** Validates an optional amount + currency pair into `body` (both empty = null). Missing is never zero. */
  function money(
    next: Record<string, string>,
    body: Record<string, unknown>,
    raw: { amount: string; currency: string },
    keys: { amount: string; currency: string },
    emptyAs: null | undefined
  ) {
    const a = raw.amount.trim();
    const c = raw.currency.trim();
    if (!a && !c) {
      if (emptyAs === null) {
        body[keys.amount] = null;
        body[keys.currency] = null;
      }
      return;
    }
    const n = Number(a);
    if (!a || !Number.isFinite(n) || n < 0) next[keys.amount] = 'Enter the amount, or clear both amount and currency.';
    if (!/^[A-Za-z]{3}$/.test(c)) next[keys.currency] = 'Use a 3-letter currency code, e.g. USD.';
    body[keys.amount] = n;
    body[keys.currency] = c.toUpperCase();
  }

  function submit() {
    const next: Record<string, string> = {};
    const body: Record<string, unknown> = {};
    let mine: Record<string, string> = {};
    if (action.kind === 'advance-stage') {
      body.to = action.to;
      mine = { stage: DEAL_STAGE_LABEL[action.to] };
    }
    if (action.kind === 'signature') {
      if (!reference.trim()) next.reference = 'Add the agreement reference.';
      body.reference = reference.trim();
      if (date) body.date = date;
      mine = { signature: [reference.trim(), date ? fmtDate(date) : null].filter(Boolean).join(' · ') };
    }
    if (action.kind === 'payment') {
      if (!date) next.date = 'Choose the payment date.';
      body.date = date;
      if (reference.trim()) body.reference = reference.trim();
      money(next, body, { amount, currency }, { amount: 'amount', currency: 'currency' }, undefined);
      mine = { payment: [fmtDate(date), reference.trim() || null, body.amount !== undefined ? `${amount} ${currency.trim().toUpperCase()}` : null].filter(Boolean).join(' · ') };
    }
    if (action.kind === 'contract') {
      money(next, body, { amount, currency }, { amount: 'amount', currency: 'currency' }, null);
      mine = { contract: body.amount === null ? 'Not recorded' : `${amount} ${currency.trim().toUpperCase()}` };
    }
    if (correcting) {
      if (!fix.agreementReference.trim()) next.agreementReference = 'The agreement reference is closure evidence and cannot be removed.';
      if (!fix.paymentDate) next.paymentDate = 'The payment date is closure evidence and cannot be removed.';
      const changed = (k: keyof typeof initial) => fix[k].trim() !== initial[k];
      if (changed('agreementReference')) body.agreementReference = fix.agreementReference.trim();
      if (changed('signatureDate')) body.signatureDate = fix.signatureDate || null;
      if (changed('paymentDate')) body.paymentDate = fix.paymentDate;
      if (changed('paymentReference')) body.paymentReference = fix.paymentReference.trim() || null;
      if (changed('paymentAmount') || changed('paymentCurrency')) {
        money(next, body, { amount: fix.paymentAmount, currency: fix.paymentCurrency }, { amount: 'paymentAmount', currency: 'paymentCurrency' }, null);
      }
      if (changed('contractAmount') || changed('contractCurrency')) {
        money(next, body, { amount: fix.contractAmount, currency: fix.contractCurrency }, { amount: 'contractAmount', currency: 'contractCurrency' }, null);
      }
      if (Object.keys(body).length === 0 && Object.keys(next).length === 0) next.reason = 'Change at least one value to correct.';
      mine = { payment: 'Corrected', contract: 'Corrected' };
    }
    if (needsReason) {
      const r = text.trim();
      if (r.length < 3) next.reason = next.reason ?? 'A reason of at least 3 characters is required.';
      body.reason = r;
    }
    if (action.kind === 'remove-fact') {
      body.fact = action.fact;
      mine = { [action.fact]: 'Removed' };
    }
    if (action.kind === 'closure-request' && text.trim()) body.note = text.trim();
    if (action.kind === 'closure-request') mine = { closure: 'Payment pending verification' };
    if (action.kind === 'closure-verify' || action.kind === 'finalize') mine = { stage: DEAL_STAGE_LABEL.closed, closure: 'Verified closed' };
    if (action.kind === 'not-proceeding') mine = { stage: DEAL_STAGE_LABEL.not_proceeding };
    if (action.kind === 'reopen') mine = { stage: DEAL_STAGE_LABEL.accepted_opportunity };
    setLocal(next);
    if (Object.keys(next).length > 0) return;
    void save({ verb: VERB[action.kind], body, mine }, deal.version);
  }

  const busy = status === 'saving';
  const errs = (key: string, ...alt: string[]) => local[key] ?? fieldMessage(fieldErrors, key, ...alt);
  const closureNotice = action.kind === 'finalize' || action.kind === 'closure-verify' || action.kind === 'closure-request' || action.kind === 'closure-reject';
  const setFixField = (k: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement>) => setFix((f) => ({ ...f, [k]: e.target.value }));

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
            {action.kind === 'signature' ? (
              <>
                <Input label="Agreement reference" required value={reference} onChange={(e) => setReference(e.target.value)} error={errs('reference')} />
                <DateInput label="Signature date (optional)" value={date} onChange={(e) => setDate(e.target.value)} error={errs('date')} />
              </>
            ) : (
              <>
                <DateInput label="Payment date" required value={date} onChange={(e) => setDate(e.target.value)} error={errs('date')} />
                <Input label="Payment reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} error={errs('reference')} />
              </>
            )}
            {action.kind === 'payment' && (
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Input
                  label="Amount received (optional)"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  error={errs('amount')}
                  helperText="A currency is required with an amount."
                />
                <Input label="Currency" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} error={errs('currency')} />
              </div>
            )}
          </div>
        )}

        {action.kind === 'contract' && (
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Input
              label="Contract amount (optional)"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={errs('amount')}
              helperText="Not the payment received. A currency is required with an amount."
            />
            <Input label="Currency" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} error={errs('currency')} />
          </div>
        )}

        {correcting && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
              <Input label="Agreement reference" required value={fix.agreementReference} onChange={setFixField('agreementReference')} error={errs('agreementReference')} />
              <DateInput label="Signature date (optional)" value={fix.signatureDate} onChange={setFixField('signatureDate')} error={errs('signatureDate')} />
              <DateInput label="Payment date" required value={fix.paymentDate} onChange={setFixField('paymentDate')} error={errs('paymentDate')} />
              <Input label="Payment reference (optional)" value={fix.paymentReference} onChange={setFixField('paymentReference')} error={errs('paymentReference')} />
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Input label="Amount received (optional)" inputMode="decimal" value={fix.paymentAmount} onChange={setFixField('paymentAmount')} error={errs('paymentAmount')} />
              <Input label="Currency" maxLength={3} value={fix.paymentCurrency} onChange={setFixField('paymentCurrency')} error={errs('paymentCurrency')} />
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Input label="Contract amount (optional)" inputMode="decimal" value={fix.contractAmount} onChange={setFixField('contractAmount')} error={errs('contractAmount')} />
              <Input label="Currency" maxLength={3} value={fix.contractCurrency} onChange={setFixField('contractCurrency')} error={errs('contractCurrency')} />
            </div>
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
          <p className="text-[13px] text-text-muted">
            Closure evidence: agreement reference and payment date. The developer submits payment received; only the Owner&rsquo;s
            verification closes the deal. A first payment or deposit is enough; it does not mean the full contract is settled.
          </p>
        )}
        {action.kind === 'reopen' && (
          <NoticePolicy tone="policy" size="block" dec="OQ-15" demo body="Reopening a lost deal is a demonstration flag. Closed deals never reopen." />
        )}

        <ActionError route={route} error={error} onRetry={() => void retry()} />
      </div>
    </Dialog>
  );
}
