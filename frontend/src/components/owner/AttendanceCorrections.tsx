'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateInput, Textarea } from '@/components/ui/Input';
import { NoticePolicy, PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { SkeletonCard, StateView } from '@/components/ui/State';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { adminPaths, listPolicyFlags } from '@/lib/api/admin';
import {
  adjustSession,
  approveRequest,
  correctionsKey,
  listReviewItems,
  rejectRequest,
  type ReviewItem,
  type ReviewKind,
  type ReviewQueueResponse,
  type VerificationState,
} from '@/lib/api/attendanceOwner';
import { ApiError } from '@/lib/api/client';
import { dateInZone, formatClock, formatDayTime, formatWeekdayDay, ROLE_LABEL, timeInZone, useCompanyTimezone, zonedToIso } from './format';

const linkButton =
  'inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-medium bg-surface-default text-text-primary border border-border-strong ' +
  'hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const VERIFICATION_TEXT: Record<VerificationState, string> = {
  recorded: 'Recorded · mode as configured',
  remote: 'remote',
  blocked: 'blocked',
  none: '—',
};

type TabId = ReviewKind;

export function AttendanceCorrections() {
  const [tab, setTab] = useState<TabId>('missing_checkout');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const timeZone = useCompanyTimezone();

  // DEC-011 is a flag: `attendance.employeeRequests` true = Alt B reading (employee requests), false = Alt A.
  const flags = useSWR(adminPaths.flags, listPolicyFlags, { revalidateOnFocus: false });
  const flagRow = flags.data?.find((f) => f.key === 'attendance.employeeRequests');
  const employeeRequests = flagRow ? flagRow.value !== false : true;

  const effectiveTab: TabId = tab === 'employee_request' && !employeeRequests ? 'missing_checkout' : tab;
  const query = { kind: effectiveTab, pageSize: 50 } as const;
  const { data, error, isLoading, mutate } = useSWR<ReviewQueueResponse>(correctionsKey(query), () => listReviewItems(query));
  // Counts for the tab labels come from the active response; the others from their own cache on first load.
  const counts = data?.counts;

  const items = data?.items ?? [];
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;
  const denied = error instanceof ApiError && (error.isPermissionDenied || error.code === 'OWNER_2FA_REQUIRED');

  const tabs = [
    { id: 'missing_checkout', label: 'Review queue', count: counts?.review },
    ...(employeeRequests ? [{ id: 'employee_request', label: 'Employee requests', count: counts?.requests }] : []),
    { id: 'corrected', label: 'Corrected sessions', count: undefined },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Corrections &amp; review</h1>
          <p className="text-[13px] text-text-secondary mt-1">Attendance · originals are never overwritten · every change is audited</p>
        </div>
        <Link href="/attendance/monitor" className={linkButton}>
          Open attendance
        </Link>
      </div>

      <Tabs
        items={tabs}
        activeId={effectiveTab}
        onChange={(id) => {
          setTab(id as TabId);
          setSelectedId(null);
        }}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6" aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error || !data ? (
        <StateView
          type="error"
          title={denied ? 'Owners only' : undefined}
          body={denied ? 'Attendance review needs an Owner session with two-factor verification.' : undefined}
          action={
            denied ? undefined : (
              <Button variant="secondary" onClick={() => mutate()}>
                Try again
              </Button>
            )
          }
        />
      ) : items.length === 0 ? (
        <StateView
          type="empty"
          title={effectiveTab === 'corrected' ? 'No corrected sessions yet' : 'Nothing needs review'}
          body={
            effectiveTab === 'corrected'
              ? 'Sessions appear here after an Owner correction is saved.'
              : 'Sessions that stay open or are flagged show up here. Nothing is waiting.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 items-start">
          <QueueList
            items={items}
            kind={effectiveTab}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            previews={effectiveTab === 'missing_checkout' ? data.previews : []}
            timeZone={timeZone}
          />
          {selected && (
            <Detail
              key={`${selected.id}:${selected.version}`}
              item={selected}
              employeeRequests={employeeRequests}
              timeZone={timeZone}
              onDone={() => mutate()}
              onOpenRequests={() => setTab('employee_request')}
            />
          )}
        </div>
      )}
    </div>
  );
}

function QueueList({
  items,
  kind,
  selectedId,
  onSelect,
  previews,
  timeZone,
}: {
  items: ReviewItem[];
  kind: ReviewKind;
  selectedId: string | null;
  onSelect: (id: string) => void;
  previews: ReviewQueueResponse['previews'];
  timeZone: string;
}) {
  const heading = kind === 'corrected' ? 'Corrected' : kind === 'employee_request' ? 'Employee requests' : 'Needs review';
  return (
    <Card className="p-5 space-y-4">
      <h2 className="text-base font-semibold text-text-primary">
        {heading} · {items.length}
      </h2>
      <ul className="space-y-2">
        {items.map((i) => {
          const active = i.id === selectedId;
          return (
            <li key={i.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(i.id)}
                className={`w-full text-left rounded-lg border p-3 space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  active ? 'bg-surface-selected border-border-selected' : 'bg-surface-default border-border-default hover:bg-surface-hover'
                }`}
              >
                <div className="text-[13px] font-semibold text-text-primary">
                  {i.kind === 'employee_request' ? 'Checkout correction request' : i.kind === 'corrected' ? 'Corrected session' : 'Missing checkout'}
                </div>
                <div className="text-xs text-text-secondary">
                  {i.employeeName} · {formatWeekdayDay(i.checkInAt, timeZone).split(' ').slice(1).join(' ')}
                  {i.kind === 'missing_checkout' && ` · in ${formatClock(i.checkInAt, timeZone)}, no checkout`}
                  {i.kind === 'employee_request' && i.requestedAt && ` · sent ${formatDayTime(i.requestedAt, timeZone)}`}
                  {i.kind === 'corrected' && i.checkOutAt && ` · out ${formatClock(i.checkOutAt, timeZone)}`}
                </div>
                {i.blocksCheckIn && (
                  <Badge tone="warning" icon="flag">
                    Blocks next check-in
                  </Badge>
                )}
                {i.kind === 'employee_request' && <PolicyPendingChip dec="DEC-011" label="Alt B reading" demo />}
              </button>
            </li>
          );
        })}
      </ul>
      {previews.length > 0 && (
        <div className="rounded-lg border border-dashed border-border-strong p-3 space-y-3">
          <p className="text-xs text-text-secondary">Preview · +{previews.length} if DEC-026 Alt B/C adopted (not counted)</p>
          {previews.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
              <div className="text-xs text-text-secondary">{p.detail}</div>
              <PolicyPendingChip dec="DEC-026" label={p.flagLabel.replace('DEC-026 ', '')} demo />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Detail({
  item,
  employeeRequests,
  timeZone,
  onDone,
  onOpenRequests,
}: {
  item: ReviewItem;
  employeeRequests: boolean;
  timeZone: string;
  onDone: () => void;
  onOpenRequests: () => void;
}) {
  const sessionDay = formatWeekdayDay(item.checkInAt, timeZone);
  return (
    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-text-primary">
          {item.employeeName} · {sessionDay} {item.checkInAt.slice(0, 4)}
        </h2>
        <p className="text-xs text-text-secondary">
          {ROLE_LABEL[item.role]} · {item.kind === 'corrected' ? 'corrected session' : 'missing checkout'} · original session kept, never overwritten
        </p>
      </div>

      <dl className="space-y-2.5 text-[13px]">
        <Row label="Check-in">
          {formatClock(item.checkInAt, timeZone)} · {VERIFICATION_TEXT[item.verification]}
        </Row>
        <Row label="Checkout">
          {item.kind === 'corrected' && item.checkOutAt ? formatClock(item.checkOutAt, timeZone) : <span className="text-text-muted">Not recorded</span>}
        </Row>
        <Row label="Session state">{item.sessionState}</Row>
      </dl>

      <div className="border-t border-border-subtle pt-4">
        {item.kind === 'corrected' ? (
          <CorrectedInfo item={item} timeZone={timeZone} />
        ) : item.kind === 'employee_request' ? (
          <RequestReview item={item} timeZone={timeZone} onDone={onDone} />
        ) : employeeRequests ? (
          <div className="space-y-3">
            <NoticePolicy
              size="block"
              dec="DEC-011"
              demo
              body="Correction authority: under this reading the employee submits a request and you approve or reject it with a reason."
            />
            <Button type="button" variant="secondary" onClick={onOpenRequests}>
              Open employee requests
            </Button>
          </div>
        ) : (
          <OwnerCorrection item={item} timeZone={timeZone} onDone={onDone} />
        )}
      </div>
      <p className="text-xs text-text-muted">Whichever applies, the correction is saved beside the original, audited as attendance.corrected, and unblocks check-in.</p>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-text-primary">{children}</dd>
    </div>
  );
}

function CorrectedInfo({ item, timeZone }: { item: ReviewItem; timeZone: string }) {
  return (
    <dl className="space-y-2.5 text-[13px]">
      <Row label="Corrected by">
        {item.correctedBy ?? '—'}
        {item.correctedAt ? ` · ${formatDayTime(item.correctedAt, timeZone)}` : ''}
      </Row>
      <Row label="Reason">{item.correctionReason ?? '—'}</Row>
    </dl>
  );
}

function saveMessage(err: unknown): { conflict: boolean; text: string } {
  if (err instanceof ApiError) {
    if (err.isVersionConflict) return { conflict: true, text: '' };
    return { conflict: false, text: err.message };
  }
  return { conflict: false, text: 'Something went wrong. Your text is kept: try again.' };
}

/** DEC-011 Alt A reading: the Owner enters the corrected checkout and a reason. */
function OwnerCorrection({ item, timeZone, onDone }: { item: ReviewItem; timeZone: string; onDone: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(() => dateInZone(item.checkInAt, timeZone));
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [submitted, setSubmitted] = useState(false);

  const iso = date && time ? zonedToIso(date, time, timeZone) : null;
  const beforeCheckIn = iso ? new Date(iso) <= new Date(item.checkInAt) : false;
  const timeError = submitted && (!time ? 'Enter the checkout time' : !iso ? 'Enter a valid time' : beforeCheckIn ? 'Checkout must be after the check-in' : undefined);
  const dateError = submitted && !date ? 'Enter the checkout date' : undefined;
  const reasonError = submitted && !reason.trim() ? 'A reason is required' : undefined;
  const msg = error ? saveMessage(error) : null;

  async function save() {
    setSubmitted(true);
    if (!iso || beforeCheckIn || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adjustSession(item, { checkOutAt: iso, reason: reason.trim() });
      toast.show({ tone: 'success', title: 'Correction saved', body: `${item.employeeName}'s original session is kept; the correction is audited.` });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-semibold text-text-primary">Correction</h3>
        <PolicyPendingChip dec="DEC-011" label="Alt A reading — not selected" demo />
      </div>
      {msg?.conflict && (
        <StateView
          type="save-conflict"
          size="inline"
          action={
            <Button type="button" variant="link" onClick={onDone}>
              Reload the latest session
            </Button>
          }
        />
      )}
      {msg && !msg.conflict && <Alert tone="danger" title="Could not save the correction" body={msg.text} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DateInput label="Checkout date" required value={date} onChange={(e) => setDate(e.target.value)} error={dateError} />
        <DateInput label="Checkout time" kind="time" required value={time} onChange={(e) => setTime(e.target.value)} error={timeError || undefined} placeholder={timeInZone(item.checkInAt, timeZone)} />
      </div>
      <Textarea label="Reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} error={reasonError} maxLength={500} helperText="Saved beside the original and audited (attendance.corrected)." />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => { setTime(''); setReason(''); setError(null); setSubmitted(false); }}>
          Cancel
        </Button>
        <Button type="submit" isLoading={busy} disabled={busy}>
          Save correction
        </Button>
      </div>
    </form>
  );
}

/** DEC-011 Alt B reading: approve or reject an employee's request. */
function RequestReview({ item, timeZone, onDone }: { item: ReviewItem; timeZone: string; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [rejectTried, setRejectTried] = useState(false);
  const msg = error ? saveMessage(error) : null;

  async function run(kind: 'approve' | 'reject') {
    if (kind === 'reject') {
      setRejectTried(true);
      if (!reason.trim()) return;
    }
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'approve') await approveRequest(item);
      else await rejectRequest(item, reason.trim());
      toast.show({ tone: 'success', title: kind === 'approve' ? 'Request approved and applied' : 'Request rejected', body: 'The decision is audited; the original session is kept.' });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-semibold text-text-primary">Employee request</h3>
        <PolicyPendingChip dec="DEC-011" label="Alt B reading — not selected" demo />
      </div>
      {msg?.conflict && (
        <StateView
          type="save-conflict"
          size="inline"
          action={
            <Button type="button" variant="link" onClick={onDone}>
              Reload the latest request
            </Button>
          }
        />
      )}
      {msg && !msg.conflict && <Alert tone="danger" title="Could not save the decision" body={msg.text} />}
      <dl className="space-y-2.5 text-[13px]">
        <Row label="Requested by">
          {item.employeeName}
          {item.requestedAt ? ` · ${formatDayTime(item.requestedAt, timeZone)}` : ''}
        </Row>
        <Row label="Proposed checkout">
          {item.proposedCheckOutAt ? `${formatWeekdayDay(item.proposedCheckOutAt, timeZone)} · ${formatClock(item.proposedCheckOutAt, timeZone)}` : '—'}
        </Row>
        <Row label="Employee’s reason">{item.employeeReason ?? '—'}</Row>
      </dl>
      <Textarea
        label="Reason (required to reject)"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why the request is rejected"
        error={rejectTried && !reason.trim() ? 'Add a reason to reject this request' : undefined}
        maxLength={500}
      />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => void run('reject')} isLoading={busy === 'reject'} disabled={busy !== null}>
          Reject…
        </Button>
        <Button type="button" onClick={() => void run('approve')} isLoading={busy === 'approve'} disabled={busy !== null}>
          Approve and apply
        </Button>
      </div>
    </div>
  );
}
