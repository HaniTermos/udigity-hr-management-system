'use client';

import React, { useState } from 'react';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import useSWR from 'swr';
import { AppShell } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { DateInput, Input, Select } from '@/components/ui/Input';
import { SkeletonTableRow, StateView } from '@/components/ui/State';
import { Pagination, Table, TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { formatDay, formatDayTime, ROLE_LABEL, useCompanyTimezone } from '@/components/owner/format';
import { auditKey, listAuditEvents, type AuditEventRow, type AuditQuery } from '@/lib/api/admin';
import { PermissionDenied } from '@/components/states/PermissionDenied';
import { ACTIONS } from '@/lib/actions';
import { ApiError } from '@/lib/api/client';
import { useCapability } from '@/lib/hooks/useCapability';
import { employeesListKey, listEmployees } from '@/lib/api/employees';

/** "deal.closure_requested" → "Deal · Closure requested": readable audit event names, raw ids never shown. */
function eventLabel(name: string): string {
  const [area, ...rest] = name.split('.');
  const words = (t: string) => t.replace(/[_-]+/g, ' ').trim();
  const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
  const action = words(rest.join(' '));
  return action ? `${cap(words(area))} · ${cap(action)}` : cap(words(area));
}

const PAGE_SIZE = 25;

/** Entity types named in plan §5 (non-business and business resource types). */
const ENTITY_TYPES = [
  'business',
  'employee',
  'attendance',
  'data_correction_request',
  'category',
  'calling_assignment',
  'call_attempt',
  'follow_up',
  'reservation',
  'deal',
  'meeting',
  'project',
  'task',
  'target',
  'work_item',
  'setting',
  'report',
].map((value) => ({ value, label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) }));

function actorLine(e: AuditEventRow) {
  const role =
    e.actorRole === 'system'
      ? 'Scheduled check'
      : e.actorRole
        ? (ROLE_LABEL as Record<string, string | undefined>)[e.actorRole] ?? e.actorRole
        : '';
  return { name: e.actorName ?? (e.actorRole === 'system' ? 'System' : 'Unknown'), role };
}

function shortId(id: string | null) {
  if (!id) return '';
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function scalar(v: unknown): string | null {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : null;
}

/** The API has no summary field: show the reason, else the changed keys, else a few payload scalars. */
function summarize(e: AuditEventRow): string {
  if (e.reason) return e.reason;
  const changed = e.after && typeof e.after === 'object' ? Object.keys(e.after as Record<string, unknown>) : [];
  if (changed.length) return `Changed: ${changed.slice(0, 3).join(', ')}${changed.length > 3 ? ` +${changed.length - 3}` : ''}`;
  if (e.payload && typeof e.payload === 'object') {
    const parts = Object.entries(e.payload as Record<string, unknown>)
      .map(([k, v]) => [k, scalar(v)] as const)
      .filter((p): p is readonly [string, string] => p[1] !== null)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`);
    if (parts.length) return parts.join(' · ');
  }
  return '—';
}

export default function AuditLogPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actorId, setActorId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [event, setEvent] = useState('');
  const [entityRef, setEntityRef] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditEventRow | null>(null);
  const timeZone = useCompanyTimezone();

  const deferredEvent = useDebouncedValue(event.trim());
  const deferredRef = useDebouncedValue(entityRef.trim());
  const query: AuditQuery = { page, pageSize: PAGE_SIZE, event: deferredEvent, actorId, entityType, entityRef: deferredRef, from, to };
  const allowed = useCapability(ACTIONS.auditRead);
  // A-07: a denied account never calls the audit endpoints.
  const { data, error, isLoading, mutate } = useSWR(allowed ? auditKey(query) : null, () => listAuditEvents(query));

  const actorQuery = { pageSize: 100 };
  const { data: people } = useSWR(allowed ? employeesListKey(actorQuery) : null, () => listEmployees(actorQuery), { revalidateOnFocus: false });
  const actorOptions = (people?.items ?? []).map((p) => ({ value: p.id, label: p.fullName }));

  const items = data?.items ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Boolean(from || to || actorId || entityType || deferredEvent || deferredRef);
  const owner2fa = error instanceof ApiError && error.code === 'OWNER_2FA_REQUIRED';
  const denied = !allowed || owner2fa || (error instanceof ApiError && error.isPermissionDenied);

  const reset = () => {
    setFrom('');
    setTo('');
    setActorId('');
    setEntityType('');
    setEvent('');
    setEntityRef('');
    setPage(1);
  };
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  // SHR-011: no page chrome for someone who cannot open the audit log.
  if (denied) {
    return (
      <AppShell>
        <PermissionDenied variant={owner2fa ? 'owner-2fa' : 'role'} area="the audit log" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Audit log</h1>
            <p className="text-[13px] text-text-secondary mt-1">
              Read-only · append-only · company time{data ? ` · ${data.total} events` : ''}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1">
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled leadingIcon={<Icon name="download" size={16} />}>
                Export
              </Button>
            </div>
            <span className="text-xs text-text-muted">Export is not available</span>
          </div>
        </div>

        {/* min-w-0 lets the inputs shrink inside their grid tracks instead of pushing past the edge. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end [&>*]:min-w-0">
          <DateInput label="From" value={from} onChange={(e) => filter(setFrom)(e.target.value)} max={to || undefined} />
          <DateInput label="To" value={to} onChange={(e) => filter(setTo)(e.target.value)} min={from || undefined} />
          <Select label="Actor" value={actorId} onChange={(e) => filter(setActorId)(e.target.value)} placeholder="All actors" options={actorOptions} />
          <Select label="Entity type" value={entityType} onChange={(e) => filter(setEntityType)(e.target.value)} placeholder="All entities" options={ENTITY_TYPES} />
          <Input label="Event" value={event} onChange={(e) => filter(setEvent)(e.target.value)} placeholder="e.g. business.created" />
          <Input label="Entity reference" value={entityRef} onChange={(e) => filter(setEntityRef)(e.target.value)} placeholder="Business, employee or record" />
        </div>

        <Alert
          tone="info"
          title="Read-only, append-only"
          body="Entries cannot be edited, deleted or hidden. Passwords, reset tokens and 2FA secrets are never recorded."
        />

        {isLoading ? (
          <div className="rounded-xl border border-border-default bg-surface-default" aria-busy="true">
            {Array.from({ length: 7 }).map((_, i) => (
              <SkeletonTableRow key={i} />
            ))}
          </div>
        ) : error ? (
          <StateView
            type="error"
            action={
              <Button variant="secondary" onClick={() => mutate()}>
                Try again
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <StateView
            type={filtered ? 'no-results' : 'empty'}
            title={filtered ? 'No events match' : 'No events recorded'}
            action={
              filtered ? (
                <Button variant="secondary" onClick={reset}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div>
            <TableContainer className="rounded-b-none">
              <Table>
                <THead>
                  <tr>
                    <TH sort="descending">Time</TH>
                    <TH>Actor</TH>
                    <TH>Event</TH>
                    <TH>Entity</TH>
                    <TH>Summary</TH>
                    <TH className="w-10">
                      <span className="sr-only">Details</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {items.map((e) => {
                    const actor = actorLine(e);
                    return (
                      <TR key={e.id} className="border-t border-border-subtle cursor-pointer" onClick={() => setOpen(e)}>
                        <TD className="whitespace-nowrap">
                          <span className="tabular-nums text-[13px]">{formatDayTime(e.occurredAt, timeZone)}</span>
                          <div className="text-xs text-text-muted">{formatDay(e.occurredAt, timeZone).split(' ').pop()}</div>
                        </TD>
                        <TD meta={actor.role} className="whitespace-nowrap">{actor.name}</TD>
                        <TD>{eventLabel(e.eventName)}</TD>
                        <TD className="text-text-secondary whitespace-nowrap" title={e.entityId ?? undefined}>
                          {e.entityType.replace(/_/g, ' ')}
                          {e.entityId ? ` · ${shortId(e.entityId)}` : ''}
                        </TD>
                        <TD className="text-text-secondary max-w-[320px] truncate" title={summarize(e)}>{summarize(e)}</TD>
                        <TD>
                          <IconButton icon="chevron-right" label={`Open ${eventLabel(e.eventName)} details`} variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); setOpen(e); }} />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableContainer>
            <Pagination
              page={data?.page ?? 1}
              pageCount={pageCount}
              onPageChange={setPage}
              rangeLabel={`Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + items.length} of ${data?.total ?? items.length} events · newest first`}
              className="rounded-b-xl border border-border-default border-t-0"
            />
          </div>
        )}

      </div>

      <Drawer isOpen={open !== null} onClose={() => setOpen(null)} title="Event detail" subtitle={open ? eventLabel(open.eventName) : undefined} width="lg">
        {open && <EventDetail event={open} timeZone={timeZone} />}
      </Drawer>
    </AppShell>
  );
}

function EventDetail({ event: e, timeZone }: { event: AuditEventRow; timeZone: string }) {
  const actor = actorLine(e);
  const rows: [string, React.ReactNode][] = [
    ['Time', formatDayTime(e.occurredAt, timeZone) + ' (company time)'],
    ['Actor', `${actor.name}${actor.role ? ` · ${actor.role}` : ''}`],
    ['Event', eventLabel(e.eventName)],
    ['Entity', `${e.entityType.replace(/_/g, ' ')}${e.entityId ? ` · ${e.entityId}` : ''}`],
    ['Summary', summarize(e)],
    ['Reason', e.reason ?? '—'],
    ['Request', e.requestId ?? '—'],
  ];
  return (
    <div className="space-y-5">
      <dl className="space-y-2 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[90px_1fr] gap-3">
            <dt className="text-text-secondary">{k}</dt>
            <dd className="text-text-primary break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {(['before', 'after'] as const).map((side) =>
        e[side] ? (
          <section key={side}>
            <h3 className="ds-overline text-text-secondary mb-1.5">{side === 'before' ? 'Before' : 'After'}</h3>
            <pre className="rounded-lg bg-surface-sunken border border-border-subtle p-3 text-xs text-text-primary overflow-x-auto">
              {JSON.stringify(e[side], null, 2)}
            </pre>
          </section>
        ) : null,
      )}
      {e.payload !== null && e.payload !== undefined && (
        <section>
          <h3 className="ds-overline text-text-secondary mb-1.5">Details</h3>
          <pre className="rounded-lg bg-surface-sunken border border-border-subtle p-3 text-xs text-text-primary overflow-x-auto">
            {JSON.stringify(e.payload, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
