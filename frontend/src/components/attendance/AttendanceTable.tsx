'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Table, TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import type { AttendanceCorrectionDto, AttendanceSessionDto, MySessionsSummary } from '@/lib/api/attendance';
import type { CompanyTime } from '@/lib/hooks/useCompanyTime';
import { PUNCTUALITY_LABEL, PUNCTUALITY_TONE, dayLabel, formatHM, rowStatus } from './format';
import { useElapsedSeconds } from './hooks';

/** SHR-004 summary tiles. */
export function SummaryTiles({ summary }: { summary: MySessionsSummary }) {
  const tiles: { label: string; value: string }[] = [
    { label: 'Sessions', value: String(summary.sessions) },
    { label: 'Hours recorded', value: formatHM(summary.totalMinutes) },
    {
      label: 'Punctuality (derived)',
      value: `On time ${summary.onTime} · Late ${summary.late}${summary.unclassified ? ` · Unclassified ${summary.unclassified}` : ''}`,
    },
    { label: 'Missing checkout', value: String(summary.missingCheckout) },
  ];
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <Card key={t.label} className="p-4">
          <dt className="text-[13px] text-text-secondary">{t.label}</dt>
          <dd className="mt-1 text-lg font-semibold text-text-primary tabular-nums">{t.value}</dd>
        </Card>
      ))}
    </dl>
  );
}

function LiveDuration({ session }: { session: AttendanceSessionDto }) {
  const seconds = useElapsedSeconds(session);
  return <>{formatHM(seconds / 60)}</>;
}

interface RowModel {
  s: AttendanceSessionDto;
  c: AttendanceCorrectionDto | undefined;
  isToday: boolean;
  status: ReturnType<typeof rowStatus>;
  canRequest: boolean;
  forgotten: boolean;
}

function toRows(sessions: AttendanceSessionDto[], todayKey: string, employeeRequests: boolean, corrections: ReadonlyMap<string, AttendanceCorrectionDto>): RowModel[] {
  return sessions.map((s) => {
    const isToday = s.workDate === todayKey;
    const c = corrections.get(s.id);
    const status = rowStatus(s, isToday, c);
    const forgotten = status.label === 'Forgotten checkout';
    return { s, c, isToday, status, forgotten, canRequest: forgotten && employeeRequests && !s.pendingCorrectionId };
  });
}

function DateCell({ r, time }: { r: RowModel; time: CompanyTime }) {
  const { s } = r;
  let sub: string | null = null;
  if (r.isToday) sub = 'Today';
  else if (s.adjusted && r.c?.decidedByName) sub = `By ${r.c.decidedByName}`;
  else if (r.c?.status === 'submitted') sub = `Request sent ${time.format(r.c.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}`;
  else if (r.c?.status === 'rejected' && r.c.decisionReason) sub = `Reason: ${r.c.decisionReason}`;
  return (
    <>
      <div className="font-medium text-text-primary">{dayLabel(s.workDate, 'short')}</div>
      {sub && <div className="text-[13px] text-text-muted">{sub}</div>}
    </>
  );
}

function CheckoutCell({ r, time }: { r: RowModel; time: CompanyTime }) {
  const { s } = r;
  if (r.c?.status === 'submitted' && r.c.proposedCheckOutAt) {
    return (
      <>
        <div>{time.formatTime(r.c.proposedCheckOutAt)} proposed</div>
        <div className="text-[13px] text-text-muted">Recorded: {s.effectiveCheckOutAt ? time.formatTime(s.effectiveCheckOutAt) : 'none'}</div>
      </>
    );
  }
  if (!s.effectiveCheckOutAt) {
    return <span className={r.forgotten ? 'text-text-secondary' : undefined}>{s.checkOutUnknown ? 'Unknown' : r.isToday ? 'Not yet' : 'Not recorded'}</span>;
  }
  return (
    <>
      <div>{time.formatTime(s.effectiveCheckOutAt)}</div>
      {s.adjusted && s.checkOutAt && s.checkOutAt !== s.effectiveCheckOutAt && <div className="text-[13px] text-text-muted">Corrected · was {time.formatTime(s.checkOutAt)}</div>}
      {s.state === 'closed_provisional' && <div className="text-[13px] text-text-muted">Provisional · office check failed</div>}
      {s.state === 'pending_review' && <div className="text-[13px] text-text-muted">Held for Owner review</div>}
    </>
  );
}

/** SCR-SHR-004 sessions: a table on desktop, a card list on phones. */
export function AttendanceTable({
  sessions,
  todayKey,
  employeeRequests,
  corrections,
  time,
  onOpen,
}: {
  sessions: AttendanceSessionDto[];
  todayKey: string;
  employeeRequests: boolean;
  corrections: ReadonlyMap<string, AttendanceCorrectionDto>;
  time: CompanyTime;
  onOpen: (s: AttendanceSessionDto) => void;
}) {
  const rows = toRows(sessions, todayKey, employeeRequests, corrections);

  return (
    <>
      <div className="hidden md:block">
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Check-in</TH>
                <TH>Check-out</TH>
                <TH align="right">Duration</TH>
                <TH>Punctuality</TH>
                <TH>Status</TH>
                <TH>
                  <span className="sr-only">Action</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.s.id}>
                  <TD>
                    <DateCell r={r} time={time} />
                  </TD>
                  <TD>{time.formatTime(r.s.effectiveCheckInAt)}</TD>
                  <TD>
                    <CheckoutCell r={r} time={time} />
                  </TD>
                  <TD numeric>
                    {r.s.state === 'open' && r.isToday ? <LiveDuration session={r.s} /> : r.s.durationMinutes === null ? '—' : formatHM(r.s.durationMinutes)}
                  </TD>
                  <TD>
                    <Badge derived tone={PUNCTUALITY_TONE[r.s.punctuality]}>
                      {PUNCTUALITY_LABEL[r.s.punctuality]}
                      {r.s.punctuality === 'late' ? ` · ${r.s.lateMinutes} min` : ''}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge tone={r.status.tone} icon={r.forgotten ? 'flag' : undefined}>
                      {r.status.label}
                    </Badge>
                  </TD>
                  <TD>
                    <Button variant="link" size="sm" onClick={() => onOpen(r.s)} aria-label={`${r.canRequest ? 'Request correction for' : 'View'} ${dayLabel(r.s.workDate, 'short')}`}>
                      {r.canRequest ? 'Request correction' : 'View'}
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </div>

      <Card className="md:hidden px-4">
        <ul className="divide-y divide-border-subtle">
          {rows.map((r) => (
            <li key={r.s.id}>
              <button
                type="button"
                onClick={() => onOpen(r.s)}
                className="w-full flex items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-lg"
              >
                <span aria-hidden className="w-9 h-9 shrink-0 rounded-full bg-brand-accent-subtle text-brand-accent-strong flex items-center justify-center">
                  <Icon name="clock" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary">
                    {dayLabel(r.s.workDate, 'short')} · {PUNCTUALITY_LABEL[r.s.punctuality]}
                  </span>
                  <span className="block text-[13px] text-text-muted">
                    {time.formatTime(r.s.effectiveCheckInAt)} – {r.s.effectiveCheckOutAt ? time.formatTime(r.s.effectiveCheckOutAt) : r.isToday ? 'now' : 'not recorded'} ·{' '}
                    {r.s.state === 'open' && r.isToday ? <LiveDuration session={r.s} /> : r.s.durationMinutes === null ? '—' : formatHM(r.s.durationMinutes)}
                  </span>
                </span>
                <Badge tone={r.status.tone}>{r.status.label}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
