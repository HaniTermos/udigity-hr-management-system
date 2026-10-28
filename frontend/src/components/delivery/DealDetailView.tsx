'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SubmitCorrectionDrawer } from '@/components/businesses/SubmitCorrectionDrawer';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardInset, CardSection } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { NoticePolicy, PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { Skeleton } from '@/components/ui/State';
import { useToast } from '@/components/ui/Toast';
import { ACTIONS } from '@/lib/actions';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks/useApi';
import { useCapability } from '@/lib/hooks/useCapability';
import { useVersionedSave } from '@/lib/hooks/useVersionedSave';
import { dealsPaths, type Deal, type DealFactKey, type DealHistoryItem, type DealResponse } from '@/lib/api/deals';
import { meetingListPath, type Meeting } from '@/lib/api/meetings';
import { createProject, retryProvisioning, type Project, type ProvisionRetryResult } from '@/lib/api/projects';
import { DEAL_CONFLICT_LABELS, DealActionDialog, describeDeal, type DealAction } from './DealDialogs';
import { ScheduleMeetingDrawer } from './ScheduleMeetingDrawer';
import {
  ActionError,
  AssignedChip,
  type ConflictSnapshot,
  DEAL_STAGE_LABEL,
  dealHistoryLabel,
  DealStageBadge,
  DeliveryConflict,
  fmtDate,
  fmtDayMonth,
  fmtTime,
  InlineError,
  LoadError,
  MEETING_STATUS_LABEL,
  MEETING_TONE,
} from './shared';

export function DealDetailView({ id }: { id: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const canCorrect = useCapability(ACTIONS.correctionSubmit);
  const { data, error, isLoading, retry } = useApi<DealResponse>(dealsPaths.detail(id));
  const history = useApi<{ items: DealHistoryItem[] }>(data ? dealsPaths.history(id) : null);
  const meetings = useApi<{ items: Meeting[] }>(data ? meetingListPath({ dealId: id }) : null);

  const [action, setAction] = useState<DealAction | null>(null);
  const [conflict, setConflict] = useState<ConflictSnapshot | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  if (error) return <LoadError error={error} onRetry={() => void retry()} what="this deal" />;
  if (isLoading || !data) return <DealDetailSkeleton />;

  const { deal, access } = data;
  const a = deal.allowed;
  const closed = deal.stage === 'closed';
  const notProceeding = deal.stage === 'not_proceeding';
  const mine = Boolean(user && deal.assignedDeveloperId === user.id);
  const isOwner = user?.role === 'owner';
  const missing: DealFactKey[] = [...(deal.facts.signature ? [] : ['signature' as const]), ...(deal.facts.payment ? [] : ['payment' as const])];

  function openConflict(mineFields: Record<string, string>) {
    setConflict({
      entity: 'deal',
      labels: DEAL_CONFLICT_LABELS,
      base: describeDeal(deal),
      mine: { ...describeDeal(deal), ...mineFields },
      baseUpdatedAt: deal.updatedAt,
    });
    void retry();
  }

  function done(_next: Deal, message: string) {
    toast.show({ tone: 'success', title: message });
    setAction(null);
    setConflict(null);
    void retry();
    void history.retry();
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] text-text-secondary">
        <Link href="/deals" className="text-text-link hover:underline">
          Deals
        </Link>
        <Icon name="chevron-right" size={12} />
        <span className="text-text-link">{deal.businessName ?? deal.code}</span>
        <Icon name="chevron-right" size={12} />
        <span>{deal.code}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl leading-8 font-semibold tracking-tight text-text-primary">{deal.businessName ?? deal.code}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
            <DealStageBadge stage={deal.stage} size="md" />
            {mine && <AssignedChip />}
            {deal.assignedDeveloperName ? (
              <span>{deal.assignedDeveloperName} · assigned developer</span>
            ) : (
              <Badge tone="warning" derived>
                Developer not assigned
              </Badge>
            )}
            <span className="text-text-muted">{deal.code}</span>
          </div>
        </div>
        {!closed && (a.markNotProceeding || a.reopen) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {a.reopen && !closed && (
              <>
                <PolicyPendingChip dec="OQ-15" demo />
                <Button variant="secondary" onClick={() => setAction({ kind: 'reopen' })}>
                  Reopen deal…
                </Button>
              </>
            )}
            {a.markNotProceeding && !closed && (
              <Button variant="ghost" onClick={() => setAction({ kind: 'not-proceeding' })}>
                Mark not proceeding…
              </Button>
            )}
          </div>
        )}
      </div>

      {conflict && (
        <DeliveryConflict
          snapshot={conflict}
          latest={describeDeal(deal)}
          latestUpdatedAt={deal.updatedAt}
          onReapply={() => setConflict(null)}
          onReload={() => {
            setConflict(null);
            setAction(null);
          }}
          onCancel={() => {
            setConflict(null);
            setAction(null);
          }}
        />
      )}

      {deal.lastRejectedReview && !closed && (
        <Alert
          tone="warning"
          title="Closure verification was rejected"
          body={`${deal.lastRejectedReview.rejectReason ?? 'No reason given.'} The deal stays ${DEAL_STAGE_LABEL.signed_and_paid.toLowerCase()}; you can request verification again.`}
        />
      )}
      {deal.openClosureReview && !closed && (
        <Alert
          tone="info"
          title="Closure verification requested"
          body={`Requested ${fmtDate(deal.openClosureReview.requestedAt)}${deal.openClosureReview.requestNote ? `: ${deal.openClosureReview.requestNote}` : '.'} Waiting for the Owner.`}
        />
      )}
      {notProceeding && deal.notProceeding && (
        <Alert tone="danger" title="This deal is not proceeding" body={`${deal.notProceeding.reason} (${fmtDate(deal.notProceeding.at)})`} />
      )}
      {closed && (
        <ProvisioningNotice
          deal={deal}
          isOwner={isOwner}
          canCreate={isOwner || mine}
          onChanged={() => {
            void retry();
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <CardSection title="Commercial facts" subtitle="Accepted ≠ signed ≠ paid ≠ closed — four separate recorded facts">
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-4 gap-3">
              <FactCard
                label="Accepted"
                recorded
                headline={fmtDate(deal.createdAt)}
                detail={deal.acceptedByName ? `${deal.acceptedByName} · from call` : 'From call'}
              />
              <FactCard
                label="Signature"
                recorded={Boolean(deal.facts.signature)}
                headline={deal.facts.signature ? fmtDate(deal.facts.signature.date) : 'Not recorded'}
                detail={deal.facts.signature ? deal.facts.signature.reference : 'Needs a date and reference'}
                actions={
                  <FactActions
                    canRecord={a.recordSignature && !deal.facts.signature}
                    canRemove={a.removeFact && Boolean(deal.facts.signature) && !closed}
                    recordLabel="Record signature"
                    onRecord={() => setAction({ kind: 'signature' })}
                    onRemove={() => setAction({ kind: 'remove-fact', fact: 'signature' })}
                  />
                }
              />
              <FactCard
                label="Payment"
                recorded={Boolean(deal.facts.payment)}
                headline={deal.facts.payment ? fmtDate(deal.facts.payment.date) : 'Not recorded'}
                detail={
                  deal.facts.payment
                    ? `${deal.facts.payment.reference}${deal.facts.payment.amount ? ` · ${deal.facts.payment.amount} ${deal.facts.payment.currency ?? ''}` : ''}`
                    : 'Needs a date and reference'
                }
                actions={
                  <FactActions
                    canRecord={a.recordPayment && !deal.facts.payment}
                    canRemove={a.removeFact && Boolean(deal.facts.payment) && !closed}
                    recordLabel="Record payment"
                    onRecord={() => setAction({ kind: 'payment' })}
                    onRemove={() => setAction({ kind: 'remove-fact', fact: 'payment' })}
                  />
                }
              />
              <FactCard
                label="Closure"
                recorded={Boolean(deal.closure)}
                headline={deal.closure ? fmtDate(deal.closure.closedAt) : 'Not closed'}
                detail={deal.closure ? (deal.closure.mode === 'direct' ? 'Finalized by developer' : 'Verified by Owner') : 'Needs all three facts'}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
              <PolicyPendingChip dec="DEC-018" label="evidence · deposit · amounts" demo />
              <span>No attachment or amount is required.</span>
            </div>
          </CardSection>

          <CardSection
            title="Closure"
            subtitle={
              closed
                ? 'Closed deal. No closure action is available.'
                : deal.policy.closureMode === 'direct'
                  ? 'Once signature and payment are recorded, the assigned developer finalizes.'
                  : 'Once signature and payment are recorded, the developer requests verification and the Owner closes the deal.'
            }
          >
            {closed || notProceeding ? (
              <CardInset className="text-sm text-text-secondary">
                {closed && deal.closure
                  ? `Closure recorded ${fmtDate(deal.closure.closedAt)}. No further closure action is available.`
                  : 'This deal is not proceeding. No closure action is available.'}
              </CardInset>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  {a.finalize && <Button onClick={() => setAction({ kind: 'finalize' })}>Finalize closure…</Button>}
                  {a.requestClosureVerification && (
                    <Button variant={a.finalize ? 'secondary' : 'primary'} onClick={() => setAction({ kind: 'closure-request' })}>
                      Request closure verification
                    </Button>
                  )}
                  {a.verifyClosure && <Button onClick={() => setAction({ kind: 'closure-verify' })}>Verify and close…</Button>}
                  {a.rejectClosure && (
                    <Button variant="secondary" onClick={() => setAction({ kind: 'closure-reject' })}>
                      Reject verification…
                    </Button>
                  )}
                  {!a.finalize && !a.requestClosureVerification && !a.verifyClosure && !a.rejectClosure && (
                    <p className="text-sm text-text-muted">
                      {missing.length > 0
                        ? `Closure becomes available once ${missing.map((m) => (m === 'signature' ? 'the signature' : 'the payment')).join(' and ')} ${missing.length > 1 ? 'are' : 'is'} recorded.`
                        : deal.openClosureReview
                          ? 'Waiting for the Owner to verify.'
                          : 'No closure action is available to you on this deal.'}
                    </p>
                  )}
                </div>
                <NoticePolicy
                  tone="policy"
                  size="block"
                  dec="DEC-006 / R-12"
                  demo
                  body={`Closure mode in force: ${deal.policy.closureMode === 'direct' ? 'direct (Alt A) — the Developer finalizes' : 'Owner verifies (Alt B) — the Developer requests, the Owner verifies'}. Not decided; R-12 → user decision.`}
                />
              </>
            )}
          </CardSection>

          <CardSection title="Handoff context">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text-primary">What the client needs</p>
              <p className="text-sm text-text-secondary whitespace-pre-line">{deal.clientNeedsNote || 'No note was recorded.'}</p>
              <p className="text-[13px] text-text-muted">Accepted by {deal.acceptedByName ?? 'Call Center'} · from Call Center</p>
            </div>
          </CardSection>

          <CardSection title="Deal history" subtitle="Every recorded change, newest first">
            {history.error ? (
              <InlineError error={history.error} onRetry={() => void history.retry()} what="the history" />
            ) : !history.data ? (
              <Skeleton className="h-16 w-full" />
            ) : history.data.items.length === 0 ? (
              <p className="text-[13px] text-text-muted">No history yet.</p>
            ) : (
              <ul className="space-y-2">
                {[...history.data.items].sort((x, y) => y.at.localeCompare(x.at)).map((h) => (
                  <li key={h.id} className="text-[13px]">
                    <p className="font-medium text-text-primary">{dealHistoryLabel(h.type)}</p>
                    <p className="text-text-muted">
                      {fmtDayMonth(h.at)} {fmtTime(h.at)}
                      {h.reason ? ` · ${h.reason}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardSection>
        </div>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Business context</h2>
            {canCorrect && (
              <button type="button" onClick={() => setCorrecting(true)} className="text-[13px] font-medium text-text-link hover:underline cursor-pointer">
                Request correction
              </button>
            )}
          </div>
          {access === 'context_limited' && <NoticeAccess type="context-limited" size="inline" title="Limited business context" body="Only what this deal needs." />}
          <dl className="grid grid-cols-[96px_1fr] gap-y-3 text-sm">
            <dt className="text-text-secondary">Business</dt>
            <dd className="text-text-primary">{deal.businessName ?? '—'}</dd>
            <dt className="text-text-secondary">Deal</dt>
            <dd className="text-text-primary">{deal.code}</dd>
            <dt className="text-text-secondary">Accepted</dt>
            <dd className="text-text-primary">{fmtDate(deal.createdAt)}</dd>
          </dl>

          <div className="border-t border-border-subtle pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary">Meetings</h3>
              {a.scheduleMeeting && (
                <button type="button" onClick={() => setScheduling(true)} className="text-[13px] font-medium text-text-link hover:underline cursor-pointer">
                  Schedule
                </button>
              )}
            </div>
            {meetings.error ? (
              <InlineError error={meetings.error} onRetry={() => void meetings.retry()} what="meetings" />
            ) : !meetings.data ? (
              <Skeleton className="h-12 w-full" />
            ) : meetings.data.items.length === 0 ? (
              <p className="text-[13px] text-text-muted">No meetings yet.</p>
            ) : (
              meetings.data.items.map((m) => (
                <div key={m.id} className="space-y-1">
                  <p className="text-sm font-medium text-text-primary">{m.title ?? 'Meeting'}</p>
                  <p className="text-[13px] text-text-muted">
                    {fmtDayMonth(m.startsAt)} {fmtTime(m.startsAt)} · {m.attendees.length} attendee{m.attendees.length === 1 ? '' : 's'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={MEETING_TONE[m.status]} hasDot>
                      {MEETING_STATUS_LABEL[m.status]}
                    </Badge>
                    {m.awaitingOutcome && (
                      <Badge tone="danger" derived>
                        Outcome due
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
            <Link href="/meetings" className="block text-[13px] font-medium text-text-link hover:underline">
              Open calendar
            </Link>
          </div>
          {deal.projectId && (
            <Link href={`/projects/${deal.projectId}`} className="block text-[13px] font-medium text-text-link hover:underline">
              Open project
            </Link>
          )}
        </Card>
      </div>

      {action && (
        <DealActionDialog
          key={action.kind}
          deal={deal}
          action={action}
          hidden={Boolean(conflict)}
          onClose={() => setAction(null)}
          onDone={done}
          onConflict={openConflict}
        />
      )}
      {correcting && (
        <SubmitCorrectionDrawer
          isOpen
          onClose={() => setCorrecting(false)}
          business={{ id: deal.businessId, name: deal.businessName ?? deal.code }}
        />
      )}
      {scheduling && (
        <ScheduleMeetingDrawer
          deal={{ id: deal.id, label: `${deal.businessName ?? deal.code} · ${deal.code}`, assignedDeveloperId: deal.assignedDeveloperId }}
          onClose={() => setScheduling(false)}
          onScheduled={() => void meetings.retry()}
        />
      )}
    </div>
  );
}

/** F3 / F2: the deal is closed first; the project follows. Failed provisioning offers the Owner retry. */
function ProvisioningNotice({
  deal,
  isOwner,
  canCreate,
  onChanged,
}: {
  deal: Deal;
  isOwner: boolean;
  canCreate: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const retrySave = useVersionedSave<null, ProvisionRetryResult>(() => retryProvisioning(deal.id), {
    onSaved: (r) => {
      toast.show(
        r.provisioning.state === 'provisioned'
          ? { tone: 'success', title: 'Project created' }
          : { tone: 'error', title: 'Provisioning failed again', body: `Attempt ${r.provisioning.attempts}. It will keep retrying automatically.` }
      );
      onChanged();
    },
  });
  const createSave = useVersionedSave<null, Project>((_i, ctx) => createProject({ dealId: deal.id }, ctx.idempotencyKey), {
    onSaved: () => {
      toast.show({ tone: 'success', title: 'Project created' });
      onChanged();
    },
  });

  if (deal.projectProvisioning === 'failed') {
    return (
      <div className="space-y-2">
        <Alert
          tone="danger"
          title="The deal is closed, but its project was not created"
          body="Project provisioning failed. The closure stands; it retries automatically, and the Owner can retry now."
        />
        <div className="flex flex-wrap items-center gap-3">
          {isOwner && (
            <Button variant="secondary" size="sm" isLoading={retrySave.status === 'saving'} onClick={() => void retrySave.save(null, deal.version)}>
              Retry provisioning
            </Button>
          )}
          <PolicyPendingChip dec="F3" demo />
        </div>
        <ActionError route={retrySave.route} error={retrySave.error} onRetry={() => void retrySave.retry()} />
      </div>
    );
  }
  if (deal.projectProvisioning === 'pending') {
    return (
      <div className="space-y-2">
        <Alert
          tone="info"
          title="Project provisioning pending"
          body={deal.policy.autoProvision ? 'The project is created automatically after closure.' : 'Projects are created manually for now (F2).'}
        />
        <div className="flex flex-wrap items-center gap-3">
          {!deal.policy.autoProvision && canCreate && (
            <Button variant="secondary" size="sm" isLoading={createSave.status === 'saving'} onClick={() => void createSave.save(null, deal.version)}>
              Create project
            </Button>
          )}
          <PolicyPendingChip dec="F2" demo />
        </div>
        <ActionError route={createSave.route} error={createSave.error} onRetry={() => void createSave.retry()} />
      </div>
    );
  }
  return null;
}

function FactActions({
  canRecord,
  canRemove,
  recordLabel,
  onRecord,
  onRemove,
}: {
  canRecord: boolean;
  canRemove: boolean;
  recordLabel: string;
  onRecord: () => void;
  onRemove: () => void;
}) {
  if (!canRecord && !canRemove) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {canRecord && (
        <Button variant="secondary" size="sm" onClick={onRecord}>
          {recordLabel}
        </Button>
      )}
      {canRemove && (
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove…
        </Button>
      )}
    </div>
  );
}

function FactCard({
  label,
  recorded,
  headline,
  detail,
  actions,
}: {
  label: string;
  recorded: boolean;
  headline: string;
  detail: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3.5 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <Badge tone={recorded ? 'success' : 'neutral'} hasDot={recorded}>
        {recorded ? 'Recorded' : 'Not recorded'}
      </Badge>
      <p className="text-sm font-semibold text-text-primary">{headline}</p>
      <p className="text-[13px] text-text-muted break-words">{detail}</p>
      {actions}
    </div>
  );
}

function DealDetailSkeleton() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto" aria-busy="true">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-96 max-w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
