'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, buildQuery, type Page } from '@/lib/api';
import { useApi } from '@/lib/hooks/useApi';
import {
  acquireReservation,
  callingPaths,
  newIdempotencyKey,
  releaseReservation,
  releaseReservationKeepalive,
  renewReservation,
  type DoNotCallItemDto,
  type FollowUpDto,
  type FollowUpListQuery,
  type OpportunitiesDto,
  type QueueDto,
  type QueueQuery,
  type RenewResultDto,
  type ReservationConflictDetails,
  type ReservationHolderDto,
  type ReservationLostDetails,
  type ReservationLostReason,
  type WorkspaceDto,
} from '@/lib/api/calling';

/* ------------------------------------------------------------- data hooks */

/** The queue is grouped client-side from one page (max 100); `total` tells the page when the rest is not shown. */
export const useQueue = (q: QueueQuery = { pageSize: 100 }) =>
  useApi<QueueDto>(`${callingPaths.queue}${buildQuery({ ...q })}`, { revalidateOnFocus: true });

export const useWorkspace = (businessId: string) => useApi<WorkspaceDto>(callingPaths.workspace(businessId), { revalidateOnFocus: false });

export const useFollowUps = (q: FollowUpListQuery | null) =>
  useApi<Page<FollowUpDto>>(q ? `${callingPaths.followUps}${buildQuery({ ...q })}` : null, { keepPreviousData: true });

export const useOpportunities = (q: { developerAssigned?: boolean; pageSize?: number } = { pageSize: 100 }) =>
  useApi<OpportunitiesDto>(`${callingPaths.opportunities}${buildQuery({ ...q })}`);

export const useDoNotCall = (q: { q?: string; sort?: 'rejectedAt' | 'businessName'; pageSize?: number } = { pageSize: 100 }) =>
  useApi<Page<DoNotCallItemDto>>(`${callingPaths.doNotCall}${buildQuery({ ...q })}`, { keepPreviousData: true });

/** Count for the "Do-not-call list (n)" header link. */
export function useDoNotCallCount(): number | null {
  const { data } = useApi<Page<DoNotCallItemDto>>(`${callingPaths.doNotCall}${buildQuery({ pageSize: 1 })}`, { revalidateOnFocus: false });
  return data ? data.total : null;
}

/** Re-render every `ms` while `enabled` (countdowns). Returns the current time in ms. */
export function useNow(ms: number, enabled: boolean): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => {
      clearInterval(id);
      clearTimeout(t);
    };
  }, [ms, enabled]);
  return now;
}

/* ------------------------------------------------- contact reservation */

export type SessionPhase = 'idle' | 'starting' | 'active' | 'lost';

export type LeaseTiming = Pick<RenewResultDto, 'leaseExpiresAt' | 'idleExpiresAt' | 'idleWarning' | 'maxTotalExpiresAt' | 'maxTotalWarning'>;

const timingOf = (l: ReservationHolderDto | RenewResultDto): LeaseTiming => ({
  leaseExpiresAt: l.leaseExpiresAt,
  idleExpiresAt: l.idleExpiresAt,
  idleWarning: 'idleWarning' in l ? l.idleWarning : false,
  maxTotalExpiresAt: l.maxTotalExpiresAt,
  maxTotalWarning: 'maxTotalWarning' in l ? l.maxTotalWarning : false,
});

const isNetwork = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.code === 'NETWORK_ERROR' || e.status >= 500);

export interface ContactSession {
  phase: SessionPhase;
  lease: ReservationHolderDto | null;
  timing: LeaseTiming | null;
  /** Why the reservation ended under the agent (the draft stays in the form). */
  lostReason: ReservationLostReason | null;
  /** ISO time the heartbeat started failing (network loss), or null. */
  offlineSince: string | null;
  /** Another agent holds the contact (409 RESERVATION_CONFLICT on start). */
  conflict: ReservationConflictDetails | null;
  startError: ApiError | null;
  start: () => Promise<boolean>;
  /** Heartbeat now ("Retry now"); `keepWorking` restarts the max-total window after its warning. */
  renewNow: (keepWorking?: boolean) => Promise<void>;
  release: () => Promise<void>;
  /** The save answered RESERVATION_LOST / outcome_not_applied. */
  markLost: (reason: ReservationLostReason) => void;
  applyLease: (r: RenewResultDto) => void;
  /** Back to idle without calling the server (after the post-save release). */
  clear: () => void;
}

/**
 * Reservation lifecycle for the open contact workspace (SEQ-09/10, calling-design §5): acquire on Start Contact,
 * heartbeat every `heartbeatSeconds` with `idleSeconds` (blur is not idle), keep-working after the max-total warning,
 * release on cancel/unmount. The server deadlines in each response are the truth; the client never trusts its own timers.
 */
export function useContactSession(businessId: string, heartbeatSeconds: number, onStale?: () => void): ContactSession {
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [lease, setLease] = useState<ReservationHolderDto | null>(null);
  const [timing, setTiming] = useState<LeaseTiming | null>(null);
  const [lostReason, setLostReason] = useState<ReservationLostReason | null>(null);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ReservationConflictDetails | null>(null);
  const [startError, setStartError] = useState<ApiError | null>(null);

  const leaseRef = useRef<ReservationHolderDto | null>(null);
  const timingRef = useRef<LeaseTiming | null>(null);
  const phaseRef = useRef<SessionPhase>('idle');
  const lastInputRef = useRef(0);
  const inFlight = useRef(false);
  const onStaleRef = useRef(onStale);
  useEffect(() => {
    leaseRef.current = lease;
    timingRef.current = timing;
    phaseRef.current = phase;
    onStaleRef.current = onStale;
  });

  const markLost = useCallback((reason: ReservationLostReason) => {
    setLostReason(reason);
    setPhase('lost');
    setOfflineSince(null);
  }, []);

  const renew = useCallback(
    async (keepWorking = false) => {
      const l = leaseRef.current;
      if (!l || phaseRef.current !== 'active' || inFlight.current) return;
      inFlight.current = true;
      const idleSeconds = Math.max(0, Math.round((Date.now() - lastInputRef.current) / 1000));
      try {
        const r = await renewReservation(l.id, { leaseToken: l.leaseToken, idleSeconds, keepWorking });
        setTiming(timingOf(r));
        setOfflineSince(null);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'RESERVATION_LOST') {
          markLost(((e.details as ReservationLostDetails | undefined)?.reason ?? 'lease_elapsed') as ReservationLostReason);
        } else if (isNetwork(e)) {
          const t = timingRef.current;
          if (t && Date.parse(t.leaseExpiresAt) < Date.now()) markLost('lease_elapsed');
          else setOfflineSince((prev) => prev ?? new Date().toISOString());
        } else if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
          markLost('access_denied');
        }
      } finally {
        inFlight.current = false;
      }
    },
    [markLost]
  );

  // Heartbeat while the contact is active.
  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => void renew(false), Math.max(5, heartbeatSeconds) * 1000);
    const onOnline = () => void renew(false);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
    };
  }, [phase, heartbeatSeconds, renew]);

  // User input resets the idle clock (blur / tab switch does not).
  useEffect(() => {
    if (phase !== 'active') return;
    const touch = () => {
      lastInputRef.current = Date.now();
    };
    touch();
    const events = ['keydown', 'pointerdown', 'input', 'wheel'] as const;
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, touch));
  }, [phase]);

  // Leaving the workspace releases the contact (best effort; the lease would lapse anyway).
  useEffect(() => {
    // Tab close / reload / navigation away. `pagehide` fires on all of them (and on bfcache entry, where the frozen
    // page could not heartbeat anyway). `visibilitychange` is deliberately NOT used to release: it also fires when
    // the agent merely switches tabs mid-call, which must keep the reservation (blur is not idle). Once released
    // the lease ref is cleared so the unmount cleanup does not send a second release.
    const releaseNow = () => {
      const l = leaseRef.current;
      if (l && phaseRef.current === 'active') {
        releaseReservationKeepalive(l.id, l.leaseToken);
        leaseRef.current = null;
      }
    };
    window.addEventListener('pagehide', releaseNow);
    return () => {
      window.removeEventListener('pagehide', releaseNow);
      const l = leaseRef.current;
      if (l && phaseRef.current === 'active') void releaseReservation(l.id, l.leaseToken).catch(() => undefined);
    };
  }, []);

  const start = useCallback(async () => {
    setPhase('starting');
    setConflict(null);
    setStartError(null);
    try {
      const l = await acquireReservation(businessId, newIdempotencyKey());
      setLease(l);
      setTiming(timingOf(l));
      setLostReason(null);
      setOfflineSince(null);
      lastInputRef.current = Date.now();
      setPhase('active');
      return true;
    } catch (e) {
      setPhase('idle');
      if (e instanceof ApiError && e.code === 'RESERVATION_CONFLICT') {
        setConflict(e.details as ReservationConflictDetails);
        onStaleRef.current?.();
      } else if (e instanceof ApiError) {
        setStartError(e);
        if (e.code === 'STATE_CONFLICT') onStaleRef.current?.();
      }
      return false;
    }
  }, [businessId]);

  const release = useCallback(async () => {
    const l = leaseRef.current;
    setPhase('idle');
    setLease(null);
    setTiming(null);
    setOfflineSince(null);
    if (l) await releaseReservation(l.id, l.leaseToken).catch(() => undefined);
  }, []);

  const clear = useCallback(() => {
    setPhase('idle');
    setLease(null);
    setTiming(null);
    setOfflineSince(null);
    setLostReason(null);
  }, []);

  const applyLease = useCallback((r: RenewResultDto) => {
    setTiming(timingOf(r));
    setOfflineSince(null);
  }, []);

  return {
    phase,
    lease,
    timing,
    lostReason,
    offlineSince,
    conflict,
    startError,
    start,
    renewNow: renew,
    release,
    markLost,
    applyLease,
    clear,
  };
}
