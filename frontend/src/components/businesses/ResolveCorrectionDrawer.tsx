'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api/client';
import {
  closeCorrectionNoChange,
  rejectCorrection,
  releaseCorrection,
  startCorrectionReview,
  type CorrectionDetail,
} from '@/lib/api/corrections';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { CardInset } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { Textarea } from '@/components/ui/Input';
import { NoticePolicy, PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { StateView } from '@/components/ui/State';
import { useToast } from '@/components/ui/Toast';
import { useCorrection } from './hooks';
import { CorrectionStatusBadge } from './CorrectionsTable';
import { formatDateTimeShort } from './format';
import { KeyValueList } from './BusinessDetailView';
import { RadioCard } from './RadioCard';

type Outcome = 'apply' | 'no_change' | 'reject';
const NOTE_MAX = 500;

const OUTCOMES: { value: Outcome; title: string; description: string }[] = [
  { value: 'apply', title: 'Apply changes', description: 'Fix it in Edit business; resolves on save.' },
  { value: 'no_change', title: 'No change needed', description: 'Already correct. Note required.' },
  { value: 'reject', title: 'Reject request', description: 'Request is wrong. Reason required.' },
];

/**
 * SCR-DE-005 Resolve correction. Open a Submitted request, take it (Submitted → In review), then pick one outcome:
 * Apply (resolves when the business is saved), No change needed, or Reject (both need a note). Resolved, Closed and
 * Rejected requests are read-only and are never reopened. Who may resolve and who is notified have no DEC ID.
 */
export function ResolveCorrectionDrawer({
  correctionId,
  onClose,
  onChanged,
}: {
  correctionId: string | null;
  onClose: () => void;
  /** Called after any change so the queue refetches. */
  onChanged: () => void;
}) {
  if (!correctionId) return null;
  return <OpenDrawer key={correctionId} id={correctionId} onClose={onClose} onChanged={onChanged} />;
}

function OpenDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, isLoading, mutate } = useCorrection(id);
  const [outcome, setOutcome] = useState<Outcome>('apply');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const run = async (fn: () => Promise<CorrectionDetail>, done: string, close: boolean) => {
    setBusy(true);
    setServerError(null);
    try {
      const next = await fn();
      await mutate(next, { revalidate: false });
      onChanged();
      toast.show({ tone: 'success', title: done });
      if (close) onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'STATE_CONFLICT' || err.isVersionConflict)) {
        // Someone else acted first: show the request as it is now.
        await mutate();
        onChanged();
        setServerError('This request changed while you had it open. The latest state is shown; nothing of yours was saved.');
      } else {
        setServerError(err instanceof ApiError ? err.message : 'That did not go through. Nothing was changed; try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const title = data ? `Correction request · ${data.businessName ?? 'Business'}` : 'Correction request';
  const subtitle = data ? `${data.issueType} · ${data.requestedBy} · ${formatDateTimeShort(data.createdAt)}` : undefined;

  if (isLoading || error || !data) {
    return (
      <Drawer isOpen onClose={onClose} title={title}>
        {isLoading ? (
          <StateView type="loading" size="inline" />
        ) : (
          <StateView type="error" size="inline" action={<Button size="sm" variant="secondary" onClick={() => mutate()}>Try again</Button>} />
        )}
      </Drawer>
    );
  }

  const terminal = data.status === 'resolved' || data.status === 'closed' || data.status === 'rejected' || data.status === 'withdrawn';
  const mine = !!user && data.reviewerId === user.id;
  const canAct = data.status === 'in_review' && (mine || user?.role === 'owner');
  const noteRequired = outcome !== 'apply';
  const noteError = tried && noteRequired && !note.trim() ? (outcome === 'reject' ? 'Give the reason for rejecting.' : 'Say what you verified.') : undefined;

  const submit = () => {
    setTried(true);
    if (outcome === 'apply') return;
    if (!note.trim()) return;
    if (outcome === 'no_change') run(() => closeCorrectionNoChange(data.id, note.trim(), data.version), 'Closed with no change', true);
    else run(() => rejectCorrection(data.id, note.trim(), data.version), 'Request rejected', true);
  };

  let footer: React.ReactNode;
  if (terminal) {
    footer = (
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    );
  } else if (data.status === 'submitted') {
    footer = (
      <>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Close
        </Button>
        <Button isLoading={busy} onClick={() => run(() => startCorrectionReview(data.id), 'Request taken', false)}>
          Take request
        </Button>
      </>
    );
  } else {
    footer = (
      <>
        {canAct && (
          <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => run(() => releaseCorrection(data.id, data.version), 'Request released', true)}>
            Release request
          </Button>
        )}
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Close
        </Button>
        {outcome === 'apply' && data.businessId ? (
          canAct ? (
            <Link href={`/businesses/${data.businessId}/edit?correction=${data.id}`} className="inline-flex">
              <Button tabIndex={-1}>Edit business</Button>
            </Link>
          ) : (
            <Button disabled>Edit business</Button>
          )
        ) : (
          <Button disabled={!canAct} isLoading={busy} variant={outcome === 'reject' ? 'destructive' : 'primary'} onClick={submit}>
            {outcome === 'reject' ? 'Reject request' : 'Close — no change'}
          </Button>
        )}
      </>
    );
  }

  return (
    <Drawer isOpen onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <CorrectionStatusBadge status={data.status} />
          {data.status === 'in_review' && data.reviewer && (
            <span className="text-[13px] leading-[18px] text-text-secondary">
              Taken by {mine ? 'you' : data.reviewer}
              {data.takenAt ? ` · ${formatDateTimeShort(data.takenAt)}` : ''}
            </span>
          )}
        </div>

        {terminal && (
          <Alert
            tone="info"
            title={`Already ${data.status === 'resolved' ? 'resolved' : data.status === 'rejected' ? 'rejected' : data.status === 'withdrawn' ? 'withdrawn' : 'closed'}${
              data.resolvedBy ? ` by ${data.resolvedBy}` : ''
            }`}
            body={`${data.resolutionNote ?? data.outcomeNote ?? 'No note.'} This request is read-only and is never reopened.`}
          />
        )}
        {serverError && <Alert tone="danger" title="Not saved" body={serverError} />}
        {data.status === 'in_review' && !canAct && (
          <Alert tone="info" title={`Taken by ${data.reviewer}`} body="Only the reviewer can resolve this request." />
        )}

        <CardInset>
          <KeyValueList
            rows={[
              { label: 'Field', value: data.field ?? 'Not a specific field', muted: !data.field },
              { label: 'Suggested', value: data.suggestedValue ?? 'None given', muted: !data.suggestedValue },
              { label: 'Explanation', value: data.explanation || '—', muted: !data.explanation },
            ]}
          />
        </CardInset>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span id="outcome-label" className="text-sm font-medium leading-5 text-text-primary">
                Outcome
              </span>
              <PolicyPendingChip dec="No DEC ID" demo />
            </div>
            {data.businessId && (
              <Link href={`/businesses/${data.businessId}`} className="text-[13px] leading-[18px] font-medium text-text-link hover:underline underline-offset-2">
                Open business detail
              </Link>
            )}
          </div>
          <div role="radiogroup" aria-labelledby="outcome-label" className="flex flex-col gap-2">
            {OUTCOMES.map((o) => (
              <RadioCard
                key={o.value}
                name="outcome"
                value={o.value}
                title={o.title}
                description={o.description}
                checked={outcome === o.value}
                disabled={!canAct || busy}
                onChange={(v) => setOutcome(v as Outcome)}
              />
            ))}
          </div>
        </div>

        <Textarea
          label="Resolution note"
          required={noteRequired}
          placeholder="What did you verify?"
          value={terminal ? data.resolutionNote ?? '' : note}
          maxLength={NOTE_MAX}
          disabled={!canAct || busy}
          onChange={(e) => setNote(e.target.value)}
          helperText="Shown to the requester."
          counter={`${(terminal ? data.resolutionNote ?? '' : note).length} / ${NOTE_MAX}`}
          error={noteError}
        />

        <NoticePolicy demo size="inline" dec="No DEC ID" body="Who may resolve a request, and who is notified, are not decided." />
      </div>
    </Drawer>
  );
}
