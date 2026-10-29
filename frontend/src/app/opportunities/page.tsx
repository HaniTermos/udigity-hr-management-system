'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Tabs } from '@/components/ui/Tabs';
import { StateView } from '@/components/ui/State';
import { ApiErrorView } from '@/components/states';
import { CallingPageHeader, HeaderLink, LoadingBlock } from '@/components/calling/CallingPageHeader';
import { HandoffPanel, OpportunitiesTable } from '@/components/calling/Opportunities';
import { useOpportunities } from '@/components/calling/hooks';
import { useCallingFormat } from '@/components/calling/format';
import { useCapability } from '@/lib/hooks/useCapability';
import { ACTIONS } from '@/lib/actions';

type Filter = 'all' | 'assigned' | 'unassigned';

/** SCR-CC-007 Opportunities & handoffs. Data: GET /api/calling/opportunities (deal fields from the BE4 read op). */
/**
 * D15 (approved 2026-10-29): accepted opportunities are handled by the assigned Developer and the Owner. A
 * Call Center user who opens this route gets a plain state (the server refuses the list as well).
 */
export default function OpportunitiesPage() {
  const allowed = useCapability(ACTIONS.opportunitiesList);
  if (!allowed) {
    return (
      <AppShell>
        <div className="max-w-[1200px] mx-auto">
          <StateView type="empty" size="page" title="Opportunities" body="Opportunities are handled by the assigned developer and the Owner." />
        </div>
      </AppShell>
    );
  }
  return <OpportunitiesView />;
}

function OpportunitiesView() {
  const f = useCallingFormat();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, error, route, isLoading, retry } = useOpportunities({
    pageSize: 100,
    ...(filter === 'all' ? {} : { developerAssigned: filter === 'assigned' }),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const current = data?.items.find((o) => o.businessId === selected) ?? data?.items[0];

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1200px] mx-auto">
        <CallingPageHeader
          title="Opportunities & Handoffs"
          subtitle={data ? `${f.dateLabel(new Date())} · accepted opportunities · not closed deals` : undefined}
          actions={
            <HeaderLink href="/queue" icon="phone">
              Calling queue
            </HeaderLink>
          }
        />

        {isLoading && <LoadingBlock />}
        {error && !data && <ApiErrorView route={route} onRetry={retry} area="opportunities" what="opportunities" backHref="/queue" backLabel="Back to Calling Queue" />}

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                style="segmented"
                activeId={filter}
                onChange={(id) => setFilter(id as Filter)}
                items={[
                  { id: 'all', label: 'All' },
                  { id: 'assigned', label: 'Developer assigned' },
                  { id: 'unassigned', label: 'Not yet assigned' },
                ]}
              />
            </div>
            {!data.dealInfoAvailable && (
              <Alert tone="info" title="Deal details are unavailable right now" body="Stage, developer and first meeting come from the delivery service. The call notes below are complete." />
            )}
            {data.items.length === 0 || !current ? (
              <StateView type="empty" size="page" title="No opportunities yet" body="Opportunities appear here when a call is saved as Accepted." />
            ) : (
              <>
                <OpportunitiesTable items={data.items} selectedId={current.businessId} onSelect={setSelected} dealInfoAvailable={data.dealInfoAvailable} />
                <HandoffPanel key={current.businessId} o={current} onChanged={() => void retry()} />
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
