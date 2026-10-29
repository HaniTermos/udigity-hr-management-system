'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSection } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Input';
import { Table, TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import type { OpportunityItemDto } from '@/lib/api/calling';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/lib/hooks/useApi';
import { newIdempotencyKey } from '@/lib/api/client';
import { dealsPaths, runDealCommand, type AssignableDeveloper, type DealResponse } from '@/lib/api/deals';
import { ScheduleMeetingDrawer } from '@/components/delivery/ScheduleMeetingDrawer';
import { DEAL_STAGE_LABEL } from '@/components/delivery/shared';
import { useCallingFormat } from './format';

function dealStageLabel(stage: string): string {
  return (DEAL_STAGE_LABEL as Record<string, string>)[stage] ?? stage.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function OpportunitiesTable({
  items,
  selectedId,
  onSelect,
  dealInfoAvailable,
}: {
  items: OpportunityItemDto[];
  selectedId: string;
  onSelect: (id: string) => void;
  dealInfoAvailable: boolean;
}) {
  const f = useCallingFormat();
  return (
    <TableContainer>
      <Table>
        <THead>
          <TR interactive={false}>
            <TH>Opportunity</TH>
            <TH>Stage</TH>
            <TH>Handoff</TH>
            <TH>Developer</TH>
            <TH align="right">First meeting</TH>
          </TR>
        </THead>
        <TBody>
          {items.map((o) => (
            <TR key={o.businessId} selected={o.businessId === selectedId} onClick={() => onSelect(o.businessId)} className="cursor-pointer">
              <TD meta={o.serviceInterest ?? undefined}>{o.businessName}</TD>
              <TD>{o.deal?.stage ? dealStageLabel(o.deal.stage) : (dealInfoAvailable ? '—' : 'Unavailable')}</TD>
              <TD>
                <Badge tone={o.deal?.developerName ? 'success' : 'warning'}>{o.deal?.developerName ? 'Developer assigned' : 'Not yet assigned'}</Badge>
              </TD>
              <TD>{o.deal?.developerName ?? 'Not yet assigned'}</TD>
              <TD numeric className="font-medium">
                {o.deal?.firstMeetingAt ? f.weekdayTime(o.deal.firstMeetingAt) : 'Not arranged'}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableContainer>
  );
}

/**
 * Handoff panel (SCR-CC-007). Assign developer uses `GET /api/deals/developers` and `POST /api/deals/:id/developer`
 * (version from the deal, one Idempotency-Key per attempt, kept across retries). DEC-005 / DEC-017 stay pending.
 */
export function HandoffPanel({ o, onChanged }: { o: OpportunityItemDto; onChanged?: () => void }) {
  const f = useCallingFormat();
  const toast = useToast();
  const developer = o.deal?.developerName ?? null;
  const dealId = o.deal?.dealId ?? null;
  const devs = useApi<{ items: AssignableDeveloper[] }>(dealId ? dealsPaths.developers : null);
  const deal = useApi<DealResponse>(dealId ? dealsPaths.detail(dealId) : null);
  const canAssign = deal.data ? deal.data.deal.allowed.assignDeveloper : false;
  const canSchedule = deal.data ? deal.data.deal.allowed.scheduleMeeting : false;
  const [developerId, setDeveloperId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const keyRef = useRef<{ key: string; sig: string } | null>(null);
  const options = useMemo(() => (devs.data?.items ?? []).map((d) => ({ value: d.id, label: d.name })), [devs.data]);

  async function assign() {
    if (!deal.data || !developerId) return;
    setBusy(true);
    setError(null);
    const sig = `${deal.data.deal.version}:${developerId}`;
    if (!keyRef.current || keyRef.current.sig !== sig) keyRef.current = { key: newIdempotencyKey(), sig };
    try {
      await runDealCommand(deal.data.deal.id, 'developer', { version: deal.data.deal.version, developerId }, keyRef.current.key);
      keyRef.current = null;
      toast.show({ tone: 'success', title: 'Developer assigned', body: o.businessName });
      setDeveloperId('');
      void deal.retry();
      onChanged?.();
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) keyRef.current = null;
      setError(status === 409 ? 'The deal changed. The latest version is loaded; choose again.' : status === 403 ? 'You cannot assign a developer on this deal.' : 'The developer could not be assigned. Try again.');
      if (status === 409) void deal.retry();
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, string][] = [
    ['Client needs', o.clientNeedsNote ?? '—'],
    ['Service interest', o.serviceInterest ?? '—'],
    ['Call notes', o.callNotes ?? '—'],
    ['Created by', o.acceptedByName ? `${o.acceptedByName}${o.acceptedAt ? ` · ${f.dayTime(o.acceptedAt)}` : ''}` : '—'],
    ['Commercial stage', o.deal ? dealStageLabel(o.deal.stage) : '—'],
  ];
  return (
    <CardSection
      title={`Handoff · ${o.businessName}`}
      subtitle={developer ? `Developer assigned: ${developer}` : 'Developer not yet assigned · meeting not yet arranged'}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6">
        <dl className="flex flex-col gap-3 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-3">
              <dt className="text-text-muted">{k}</dt>
              <dd className="text-text-primary whitespace-pre-line break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-3">
          <Select
            label="Developer"
            placeholder={devs.isLoading ? 'Loading developers…' : 'Choose a developer'}
            value={developerId}
            disabled={!dealId || !canAssign || busy}
            onChange={(e) => setDeveloperId(e.target.value)}
            options={options}
            error={error ?? undefined}
            helperText={
              !dealId
                ? 'No deal is linked to this opportunity yet.'
                : !deal.data
                  ? 'Loading the deal…'
                  : !canAssign
                    ? 'You cannot assign a developer on this deal.'
                    : developer
                      ? `Currently ${developer}. Choosing another reassigns the deal.`
                      : undefined
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={!developerId || !canAssign || busy} isLoading={busy} onClick={() => void assign()} leadingIcon={<Icon name="user" size={16} />}>
              {developer ? 'Reassign developer' : 'Assign developer'}
            </Button>
            <Button variant="secondary" disabled={!dealId || !canSchedule} onClick={() => setMeetingOpen(true)} leadingIcon={<Icon name="calendar" size={16} />}>
              Schedule first meeting
            </Button>
          </div>
          {o.accessLevel === 'context_limited' && <Badge tone="info">Limited view</Badge>}
        </div>
      </div>
      {meetingOpen && dealId && (
        <ScheduleMeetingDrawer
          deal={{ id: dealId, label: o.businessName, assignedDeveloperId: o.deal?.developerId ?? null }}
          onClose={() => setMeetingOpen(false)}
          onScheduled={() => onChanged?.()}
        />
      )}
    </CardSection>
  );
}
