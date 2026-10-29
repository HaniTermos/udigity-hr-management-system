'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSection } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Icon } from '@/components/ui/Icon';
import { SearchInput } from '@/components/ui/Input';
import { StateView } from '@/components/ui/State';
import { Table, TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ApiErrorView } from '@/components/states';
import { useAuth } from '@/lib/auth';
import { ACTIONS } from '@/lib/actions';
import { CallingPageHeader, HeaderLink, LoadingBlock } from '@/components/calling/CallingPageHeader';
import { ReopenDialog } from '@/components/calling/ContactWorkspace';
import { useDoNotCall } from '@/components/calling/hooks';
import { useCallingFormat } from '@/components/calling/format';
import { useBusinessAccess } from '@/components/businesses/hooks';
import { SubmitCorrectionDrawer } from '@/components/businesses/SubmitCorrectionDrawer';

/**
 * SCR-CC-008 Do-not-call list. Rejected businesses are excluded from calling for everyone. Reopening is Owner-only
 * (DEC-016, Demonstration alternative — not approved); other roles see it disabled.
 */
export default function DoNotCallPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const access = useBusinessAccess();
  const f = useCallingFormat();
  const [q, setQ] = useState('');
  const { data, error, route, isLoading, retry, mutate } = useDoNotCall({ pageSize: 100, ...(q.trim() ? { q: q.trim() } : {}) });
  const [selected, setSelected] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const current = data?.items.find((r) => r.businessId === selected) ?? data?.items[0];

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1200px] mx-auto">
        <CallingPageHeader
          title="Do-not-call list"
          subtitle="Rejected businesses · excluded from calling, assignment and new follow-ups"
          actions={
            <HeaderLink href="/queue" icon="phone">
              Calling queue
            </HeaderLink>
          }
        />

        <Alert
          tone="info"
          title={isOwner ? 'You can reopen a business' : 'Reopening is controlled'}
          body={
            isOwner
              ? 'Reopening needs a reason and returns the business to Pending. The rejection stays in the history.'
              : 'You can view this list but only the Owner can reopen a business.'
          }
        />

        {isLoading && <LoadingBlock />}
        {error && !data && <ApiErrorView route={route} onRetry={retry} area="the do-not-call list" what="the do-not-call list" backHref="/queue" backLabel="Back to Calling Queue" />}

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput label="Search by business name" placeholder="Search by business name" value={q} onChange={(e) => setQ(e.target.value)} wrapperClassName="sm:w-[260px]" />
              <Badge tone="brand">Rejected ({data.total})</Badge>
            </div>

            {data.items.length === 0 || !current ? (
              <StateView
                type={q.trim() ? 'no-results' : 'empty'}
                size="page"
                title={q.trim() ? 'No matches' : 'No do-not-call businesses'}
                body={q.trim() ? 'No rejected business matches this search.' : 'Businesses saved as Rejected appear here.'}
              />
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <THead>
                      <TR interactive={false}>
                        <TH>Business</TH>
                        <TH>Status</TH>
                        <TH>Assigned to</TH>
                        <TH>Rejected by</TH>
                        <TH align="right">Rejected</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {data.items.map((r) => (
                        <TR key={r.businessId} selected={r.businessId === current.businessId} onClick={() => setSelected(r.businessId)} className="cursor-pointer">
                          <TD>{r.businessName}</TD>
                          <TD>
                            <Badge tone="danger">Do not call</Badge>
                          </TD>
                          <TD>{r.assigneeName ?? 'Unassigned'}</TD>
                          <TD>{r.rejectedByName ?? '—'}</TD>
                          <TD numeric>{r.rejectedAt ? f.dayTime(r.rejectedAt) : '—'}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableContainer>

                <CardSection
                  title={current.businessName}
                  subtitle="Do not call · Start Contact disabled"
                  action={
                    access.allowed(ACTIONS.correctionSubmit) ? (
                      <button type="button" onClick={() => setCorrectionOpen(true)} className="inline-flex items-center gap-1 text-text-link hover:underline cursor-pointer">
                        Request correction <Icon name="flag" size={14} />
                      </button>
                    ) : undefined
                  }
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <dl className="flex flex-col gap-3 text-sm">
                      {(
                        [
                          ['Rejected by', current.rejectedByName ?? '—'],
                          ['Reason', current.rejectionReason ?? '—'],
                          ['Call history', `${current.attemptCount} attempt${current.attemptCount === 1 ? '' : 's'}`],
                        ] as [string, string][]
                      ).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[120px_1fr] gap-3">
                          <dt className="text-text-muted">{k}</dt>
                          <dd className="text-text-primary whitespace-pre-line break-words">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/businesses/${current.businessId}`}>
                          <Button variant="secondary" tabIndex={-1}>
                            Open business
                          </Button>
                        </Link>
                        <Button variant="secondary" disabled leadingIcon={<Icon name="phone" size={16} />}>
                          Start Contact
                        </Button>
                        <Button variant="secondary" disabled={!isOwner} onClick={() => setReopening(true)} leadingIcon={<Icon name="refresh" size={16} />}>
                          Reopen…
                        </Button>
                      </div>
                      <p className="text-[13px] text-text-muted">
                        {isOwner
                          ? 'Reopen asks for a reason and moves the business back to Pending.'
                          : 'Reopen is not permitted for your role: only the Owner can reopen a business.'}
                      </p>
                    </div>
                  </div>
                </CardSection>
              </>
            )}
          </>
        )}
      </div>

      {current && (
        <>
          <ReopenDialog
            mode="reopen"
            target={reopening ? { businessId: current.businessId, name: current.businessName, stateVersion: current.stateVersion } : null}
            onClose={() => setReopening(false)}
            onDone={() => {
              setReopening(false);
              void mutate();
            }}
          />
          <SubmitCorrectionDrawer isOpen={correctionOpen} onClose={() => setCorrectionOpen(false)} business={{ id: current.businessId, name: current.businessName }} />
        </>
      )}
    </AppShell>
  );
}
