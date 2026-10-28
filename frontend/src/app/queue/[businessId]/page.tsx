'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ApiErrorView } from '@/components/states';
import { useAuth } from '@/lib/auth';
import { ACTIONS } from '@/lib/actions';
import type { LogAttemptResultDto } from '@/lib/api/calling';
import { CallingPageHeader, HeaderLink, LoadingBlock } from '@/components/calling/CallingPageHeader';
import {
  BusinessCard,
  CallHistory,
  ContactPanel,
  InboundRejectionDialog,
  OverrideDialog,
  ReopenDialog,
  ReservationBanner,
} from '@/components/calling/ContactWorkspace';
import { LogAttemptPanel } from '@/components/calling/LogAttemptPanel';
import { QueueRail } from '@/components/calling/QueueRail';
import { ReservationPolicyNotice } from '@/components/calling/PolicyNotes';
import { useContactSession, useDoNotCallCount, useQueue, useWorkspace } from '@/components/calling/hooks';
import { useBusiness, useBusinessAccess } from '@/components/businesses/hooks';
import { SubmitCorrectionDrawer } from '@/components/businesses/SubmitCorrectionDrawer';

/**
 * SCR-CC-002 / 003 / 005 contact workspace: reservation acquire + heartbeat, log attempt, every reservation state
 * (other agent, expiring, expired, offline, stale client, overridden by Owner) and the error screens.
 */
export default function ContactWorkspacePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const router = useRouter();
  const legacyDnc = businessId === 'dnc';

  // The sidebar still links /queue/dnc (FE1 file); forward it to the real route.
  useEffect(() => {
    if (legacyDnc) router.replace('/do-not-call');
  }, [legacyDnc, router]);

  if (legacyDnc) return null;
  return <Workspace businessId={businessId} />;
}

function Workspace({ businessId }: { businessId: string }) {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const access = useBusinessAccess();
  const { data: queue } = useQueue();
  const dncCount = useDoNotCallCount();
  const { data: w, error, route, isLoading, retry, mutate } = useWorkspace(businessId);
  const { data: business, error: businessError } = useBusiness(businessId);
  const session = useContactSession(businessId, w?.policy.heartbeatSeconds ?? 60, () => void mutate());

  const [saved, setSaved] = useState<LogAttemptResultDto | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [inboundOpen, setInboundOpen] = useState(false);
  const [reopen, setReopen] = useState<'reopen' | 'requeue' | null>(null);

  const panelOpen = session.phase === 'active' || session.phase === 'lost' || saved !== null;
  const canCorrect = access.allowed(ACTIONS.correctionSubmit);
  const refresh = () => void mutate();

  const startAgain = async () => {
    await session.start();
    refresh();
  };

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1200px] mx-auto">
        <CallingPageHeader
          breadcrumb={
            <>
              <Link href="/queue" className="text-text-link hover:underline">
                Calling Queue
              </Link>{' '}
              &gt; {w?.businessName ?? '…'}
            </>
          }
          title="Contact workspace"
          actions={
            <>
              <HeaderLink href="/calendar" icon="calendar">
                Follow-ups &amp; Calendar
              </HeaderLink>
              <HeaderLink href="/do-not-call" icon="ban">
                Do-not-call list{dncCount !== null ? ` (${dncCount})` : ''}
              </HeaderLink>
            </>
          }
        />

        {isLoading && <LoadingBlock />}
        {error && !w && <ApiErrorView route={route} onRetry={retry} backHref="/queue" backLabel="Back to Calling Queue" area="this business" what="the workspace" />}

        {w && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)] gap-4 items-start">
            <div className="order-2 lg:order-1">{queue && <QueueRail queue={queue} activeId={businessId} dncCount={dncCount} />}</div>
            <div className="order-1 lg:order-2 flex flex-col gap-4">
              <ReservationBanner w={w} session={session} isOwner={isOwner} onOverride={() => setOverrideOpen(true)} onReopen={() => void startAgain()} />
              <ReservationPolicyNotice />
              <BusinessCard
                w={w}
                business={business}
                detailUnavailable={!business && !!businessError}
                onRequestCorrection={canCorrect ? () => setCorrectionOpen(true) : undefined}
              />
              <CallHistory w={w} />
            </div>
            <div className="order-1 lg:order-3">
              {panelOpen ? (
                <LogAttemptPanel
                  w={w}
                  session={session}
                  saved={saved}
                  onSaved={(r) => {
                    setSaved(r);
                    refresh();
                  }}
                  onDismissSaved={() => setSaved(null)}
                  onRefresh={refresh}
                  onCancel={async () => {
                    await session.release();
                    refresh();
                  }}
                />
              ) : (
                <ContactPanel
                  w={w}
                  session={session}
                  isOwner={isOwner}
                  onRetry={refresh}
                  onStart={async () => {
                    setSaved(null);
                    await session.start();
                    refresh();
                  }}
                  onReopen={() => setReopen('reopen')}
                  onRequeue={() => setReopen('requeue')}
                  onInbound={() => setInboundOpen(true)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {w && (
        <>
          <SubmitCorrectionDrawer
            isOpen={correctionOpen}
            onClose={() => setCorrectionOpen(false)}
            business={{ id: w.businessId, name: w.businessName }}
            openRequests={business?.corrections}
          />
          <OverrideDialog
            open={overrideOpen}
            reservationId={w.reservation.id}
            holderName={w.reservation.holderName}
            onClose={() => setOverrideOpen(false)}
            onDone={() => {
              setOverrideOpen(false);
              refresh();
            }}
          />
          <InboundRejectionDialog
            open={inboundOpen}
            w={w}
            onClose={() => setInboundOpen(false)}
            onDone={() => {
              setInboundOpen(false);
              refresh();
            }}
          />
          <ReopenDialog
            mode={reopen ?? 'reopen'}
            target={reopen ? { businessId: w.businessId, name: w.businessName, stateVersion: w.state.version } : null}
            onClose={() => setReopen(null)}
            onDone={() => {
              setReopen(null);
              refresh();
            }}
          />
        </>
      )}
    </AppShell>
  );
}
