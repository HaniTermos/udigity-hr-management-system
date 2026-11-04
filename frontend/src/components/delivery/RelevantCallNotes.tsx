'use client';

import React from 'react';
import { CardSection } from '@/components/ui/Card';
import { useApi } from '@/lib/hooks/useApi';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';

/** GET /api/deals/:id/call-notes (D15, BE2): read-only call notes for the assigned Developer and the Owner. */
interface RelevantCallNote {
  attemptId: string;
  attemptedAt: string;
  outcome: string;
  notes: string | null;
  clientNeedsNote: string | null;
  serviceInterest: string | null;
}

const OUTCOME_LABEL: Record<string, string> = {
  accepted: 'Accepted',
  needs_another_call: 'Needs another call',
  on_hold: 'On hold',
  rejected: 'Rejected',
};

/**
 * D15 (approved 2026-10-29) "Relevant call notes" on the deal detail. Rendered only for the assigned Developer
 * or the Owner (`show`); the server applies the same gate. Read-only: no agent identity, no editing.
 */
export function RelevantCallNotes({ dealId, show }: { dealId: string; show: boolean }) {
  const time = useCompanyTime();
  const { data, error } = useApi<{ items: RelevantCallNote[] }>(show ? `/api/deals/${dealId}/call-notes` : null, { refreshInterval: 0 });
  if (!show) return null;
  return (
    <CardSection title="Relevant call notes" subtitle="From the calls on this business · read-only">
      {error ? (
        <p className="text-sm text-text-secondary">Call notes could not be loaded.</p>
      ) : !data ? (
        <p className="text-sm text-text-muted">Loading call notes…</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-text-secondary">No call notes were recorded.</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((n) => (
            <li key={n.attemptId} className="space-y-0.5">
              <p className="text-[13px] text-text-muted">
                {time.format(n.attemptedAt)} · {OUTCOME_LABEL[n.outcome] ?? n.outcome}
              </p>
              {n.notes && <p className="text-sm text-text-primary whitespace-pre-line">{n.notes}</p>}
              {n.clientNeedsNote && <p className="text-sm text-text-secondary whitespace-pre-line">Client needs: {n.clientNeedsNote}</p>}
              {n.serviceInterest && <p className="text-sm text-text-secondary">Service interest: {n.serviceInterest}</p>}
            </li>
          ))}
        </ul>
      )}
    </CardSection>
  );
}
