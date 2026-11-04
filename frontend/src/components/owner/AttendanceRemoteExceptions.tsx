'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { DateInput, Select, Textarea } from '@/components/ui/Input';
import { ApiError } from '@/lib/api/client';
import {
  decideRemoteException,
  grantRemoteException,
  listRemoteExceptions,
  remoteExceptionsKey,
  type RemoteExceptionDto,
  type RemoteExceptionStatus,
} from '@/lib/api/attendance';
import { newIdempotencyKey } from '@/lib/api/client';

const REASON_MAX = 500;

const STATUS_LABEL: Record<RemoteExceptionStatus, string> = {
  requested: 'Requested',
  granted: 'Granted',
  rejected: 'Rejected',
  revoked: 'Revoked',
};

const STATUS_TONE: Record<RemoteExceptionStatus, 'warning' | 'success' | 'neutral'> = {
  requested: 'warning',
  granted: 'success',
  rejected: 'neutral',
  revoked: 'neutral',
};

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.isVersionConflict) return 'This exception changed meanwhile. Close the panel and try again.';
    const first = Object.values(err.fieldErrors)[0];
    if (first?.[0]) return first[0];
    if (err.message) return err.message;
  }
  return fallback;
}

const range = (d: RemoteExceptionDto) => (d.startDate === d.endDate ? d.startDate : `${d.startDate} – ${d.endDate}`);

type Action = { kind: 'approve' | 'reject' | 'revoke'; item: RemoteExceptionDto };

/**
 * D3 remote exceptions (Owner): grant one for an employee and a date or range, approve or reject a request,
 * revoke a granted one. Every change is audited by the server; reasons are required for the Owner's own decisions.
 */
export function AttendanceRemoteExceptions({
  employees,
  onChanged,
}: {
  employees: { value: string; label: string }[];
  onChanged: () => void;
}) {
  const query = { pageSize: 50 };
  const { data, error, mutate } = useSWR(remoteExceptionsKey(query), () => listRemoteExceptions(query), { revalidateOnFocus: false });
  const [adding, setAdding] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const changed = () => {
    void mutate();
    onChanged();
  };
  // Open work first: requests waiting for a decision, then granted; finished ones last.
  const items = useMemo(() => {
    const order: Record<RemoteExceptionStatus, number> = { requested: 0, granted: 1, rejected: 2, revoked: 3 };
    return [...(data?.items ?? [])].sort((a, b) => order[a.status] - order[b.status] || b.startDate.localeCompare(a.startDate));
  }, [data]);

  return (
    <Card className="p-5 space-y-4" aria-labelledby="remote-exceptions-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="remote-exceptions-title" className="text-base font-semibold text-text-primary">
          Remote exceptions
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          Grant exception
        </Button>
      </div>
      <p className="text-xs text-text-muted">Lets one employee check in from outside the office for the chosen dates. Their session is labelled Remote.</p>
      {error ? (
        <p className="text-[13px] text-text-secondary">Remote exceptions could not be loaded.</p>
      ) : !data ? (
        <p className="text-[13px] text-text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No remote exceptions yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-text-primary truncate">{d.employeeName}</span>
                  <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                </div>
                <div className="text-xs text-text-secondary tabular-nums">{range(d)}</div>
                <div className="text-xs text-text-muted break-words">{d.reason}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                {d.status === 'requested' && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setAction({ kind: 'approve', item: d })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAction({ kind: 'reject', item: d })}>
                      Reject
                    </Button>
                  </>
                )}
                {d.status === 'granted' && (
                  <Button size="sm" variant="ghost" onClick={() => setAction({ kind: 'revoke', item: d })}>
                    Revoke
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding && <GrantDrawer employees={employees} onClose={() => setAdding(false)} onSaved={changed} />}
      {action && <DecisionDrawer action={action} onClose={() => setAction(null)} onSaved={changed} />}
    </Card>
  );
}

function GrantDrawer({ employees, onClose, onSaved }: { employees: { value: string; label: string }[]; onClose: () => void; onSaved: () => void }) {
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  // One key for the whole action, so a retry after a lost answer cannot grant twice.
  const [key] = useState(newIdempotencyKey);
  const problem = !employeeId
    ? 'Choose the employee.'
    : !startDate
      ? 'Choose the first day.'
      : endDate && endDate < startDate
        ? 'The last day is before the first day.'
        : !reason.trim()
          ? 'Add a reason.'
          : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setAlert(null);
    try {
      await grantRemoteException({ employeeId, startDate, endDate: endDate || undefined, reason: reason.trim() }, key);
      onSaved();
      onClose();
    } catch (err) {
      setAlert(errorText(err, 'The exception was not saved. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer isOpen onClose={onClose} title="Grant remote exception" subtitle="The employee can check in from outside the office on these dates">
      <form onSubmit={submit} noValidate className="space-y-4">
        {alert && <Alert tone="danger" title="Not saved" body={alert} />}
        <Select label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="Choose an employee" options={employees} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DateInput label="First day" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <DateInput label="Last day (optional)" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Textarea
          label="Reason"
          required
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          counter={`${reason.length} / ${REASON_MAX}`}
          onChange={(e) => setReason(e.target.value)}
        />
        {problem && <p className="text-[13px] text-text-muted">{problem}</p>}
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy} disabled={Boolean(problem)}>
            Grant exception
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

const ACTION_COPY = {
  approve: { title: 'Approve remote exception', cta: 'Approve', done: 'Approving lets the employee check in from outside the office on these dates.', reasonRequired: false },
  reject: { title: 'Reject remote exception', cta: 'Reject', done: 'The employee is told the request was rejected.', reasonRequired: true },
  revoke: { title: 'Revoke remote exception', cta: 'Revoke', done: 'From now on the employee must check in from the office on these dates.', reasonRequired: true },
} as const;

function DecisionDrawer({ action, onClose, onSaved }: { action: Action; onClose: () => void; onSaved: () => void }) {
  const copy = ACTION_COPY[action.kind];
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [key] = useState(newIdempotencyKey);
  const missing = copy.reasonRequired && !reason.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missing || busy) return;
    setBusy(true);
    setAlert(null);
    try {
      await decideRemoteException(action.item, action.kind, reason.trim() || undefined, key);
      onSaved();
      onClose();
    } catch (err) {
      setAlert(errorText(err, 'The decision was not saved. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer isOpen onClose={onClose} title={copy.title} subtitle={`${action.item.employeeName} · ${range(action.item)}`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {alert && <Alert tone="danger" title="Not saved" body={alert} />}
        <p className="text-sm text-text-secondary">{copy.done}</p>
        <Textarea
          label={copy.reasonRequired ? 'Reason' : 'Reason (optional)'}
          required={copy.reasonRequired}
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          counter={`${reason.length} / ${REASON_MAX}`}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Back
          </Button>
          <Button type="submit" variant={action.kind === 'approve' ? 'primary' : 'destructive'} isLoading={busy} disabled={missing}>
            {copy.cta}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
