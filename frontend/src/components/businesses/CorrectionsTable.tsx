import React from 'react';
import Link from 'next/link';
import type { CorrectionRow, CorrectionStatus, CorrectionTab } from '@/lib/api/corrections';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pagination, Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { StateView } from '@/components/ui/State';
import { ListSkeleton } from './AsyncState';
import { formatAge, formatDateTimeShort } from './format';

const STATUS: Record<CorrectionStatus, { label: string; tone: BadgeTone }> = {
  submitted: { label: 'Submitted', tone: 'info' },
  in_review: { label: 'In review', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

export function CorrectionStatusBadge({ status }: { status: CorrectionStatus }) {
  const s = STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const Dash = () => (
  <span className="text-text-muted" aria-label="Not shown">
    —
  </span>
);

const EMPTY_COPY: Record<CorrectionTab, { title: string; body: string }> = {
  open: { title: 'No open requests', body: 'New requests from Call Center, Developers and the Owner appear here.' },
  resolved: { title: 'Nothing resolved yet', body: 'Requests you resolve are listed here for reference.' },
  closed: { title: 'Nothing closed or rejected', body: 'Requests closed with no change, or rejected, are listed here.' },
  withdrawn: { title: 'No withdrawn requests', body: 'A requester can withdraw a request before it is in review.' },
};

/** SCR-DE-006 queue table. Redacted rows (business hidden by policy, DEC-002) carry no detail and no action. */
export function CorrectionsTable({
  rows,
  tab,
  loading,
  error,
  selectedId,
  page,
  pageSize,
  total,
  countTotal,
  onOpen,
  onPageChange,
}: {
  rows: CorrectionRow[];
  tab: CorrectionTab;
  loading?: boolean;
  error?: React.ReactNode;
  selectedId?: string | null;
  page: number;
  pageSize: number;
  total: number;
  /** Total shown in the footer. Redacted rows are not counted (DEC-002), so this can be lower than `total`. */
  countTotal?: number;
  onOpen: (row: CorrectionRow) => void;
  onPageChange: (page: number) => void;
}) {
  const open = tab === 'open';
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const shown = countTotal ?? total;
  const from = shown === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(shown, page * pageSize);
  const empty = EMPTY_COPY[tab];

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border-default bg-surface-default">
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Correction requests table (scrolls sideways)">
        <Table aria-label="Correction requests">
          <THead>
            <tr>
              <TH>Business</TH>
              <TH>{open ? 'Issue' : 'Issue · outcome'}</TH>
              <TH>Requested by</TH>
              <TH sort={open ? 'descending' : undefined}>{open ? 'Age' : 'Closed'}</TH>
              <TH>Status</TH>
              <TH>{open ? 'Reviewer' : 'Resolved by'}</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) =>
              r.redacted ? (
                <TR key={r.id} interactive={false} className="bg-surface-subtle">
                  <TD meta={r.businessMeta}>{r.businessName}</TD>
                  <TD>
                    <Dash />
                  </TD>
                  <TD>
                    <Dash />
                  </TD>
                  <TD>
                    <Dash />
                  </TD>
                  <TD>
                    <Badge tone="neutral">Owner review only</Badge>
                  </TD>
                  <TD>
                    <Dash />
                  </TD>
                  <TD className="text-right">
                    <Dash />
                  </TD>
                </TR>
              ) : (
                <TR key={r.id} selected={selectedId === r.id}>
                  <TD className="max-w-[240px]" meta={r.businessMeta}>
                    {r.businessId ? (
                      <Link href={`/businesses/${r.businessId}`} className="hover:underline underline-offset-2">
                        {r.businessName}
                      </Link>
                    ) : (
                      r.businessName
                    )}
                  </TD>
                  <TD className="max-w-[260px]" meta={open ? r.issueDetail : r.outcomeNote ?? r.issueDetail}>
                    {r.issueType}
                  </TD>
                  <TD meta={r.requestedByRole}>{r.requestedBy}</TD>
                  <TD meta={formatDateTimeShort(r.createdAt)}>{formatAge(r.createdAt)}</TD>
                  <TD>
                    <CorrectionStatusBadge status={r.status} />
                  </TD>
                  <TD>{open ? r.reviewer ?? <Dash /> : r.resolvedBy ?? <Dash />}</TD>
                  <TD className="text-right">
                    <Button variant="link" onClick={() => onOpen(r)} aria-label={`Open request: ${r.issueType} for ${r.businessName}`}>
                      Open
                    </Button>
                  </TD>
                </TR>
              )
            )}
          </TBody>
        </Table>
      </div>

      {loading && rows.length === 0 && <ListSkeleton rows={4} />}
      {error}
      {!loading && !error && rows.length === 0 && (
        <div className="border-t border-border-subtle">
          <StateView type="empty" title={empty.title} body={empty.body} />
        </div>
      )}
      {!error && (
        <Pagination
          page={page}
          pageCount={pageCount}
          onPageChange={onPageChange}
          rangeLabel={loading && rows.length === 0 ? undefined : `Showing ${from}–${to} of ${shown}${open ? ' open' : ''}`}
          perPage={`${pageSize} per page`}
        />
      )}
    </div>
  );
}
