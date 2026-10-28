'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  attendancePaths,
  getAttendanceFlags,
  getMyCorrections,
  getMySessions,
  getToday,
  type AttendanceCorrectionDto,
  type AttendanceSessionDto,
  type AttendanceTodayDto,
  type MySessionsQuery,
} from '@/lib/api/attendance';
import { getMyTargets, getMyWorkList, myDayPaths } from '@/lib/api/myDay';
import { useAuth } from '@/lib/auth';

/** Today's attendance (shared by My Day, the header chip and `useCompanyTime`: one SWR key, one request). */
export function useToday() {
  const { user, sessionState } = useAuth();
  const enabled = Boolean(user) && sessionState === 'active';
  return useSWR<AttendanceTodayDto>(enabled ? attendancePaths.today : null, getToday, {
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });
}

export function useMySessions(q: MySessionsQuery, enabled = true) {
  const key = !enabled ? null : `${attendancePaths.mySessions}?from=${q.from ?? ''}&to=${q.to ?? ''}&page=${q.page ?? 1}&pageSize=${q.pageSize ?? 25}`;
  return useSWR(key, () => getMySessions(q), { keepPreviousData: true });
}

/** Own correction requests, newest first; the table maps them to sessions by `sessionId`. */
export function useMyCorrections(enabled = true) {
  return useSWR(enabled ? `${attendancePaths.corrections}?pageSize=100` : null, () => getMyCorrections({ pageSize: 100 }));
}

/** The latest request per session, so a row can show Pending / Approved / Rejected. */
export function latestBySession(items: readonly AttendanceCorrectionDto[] | undefined): Map<string, AttendanceCorrectionDto> {
  const map = new Map<string, AttendanceCorrectionDto>();
  for (const c of items ?? []) {
    if (!c.sessionId || c.kind !== 'request') continue;
    const prev = map.get(c.sessionId);
    if (!prev || Date.parse(c.createdAt) > Date.parse(prev.createdAt)) map.set(c.sessionId, c);
  }
  return map;
}

/** The demonstration flags (DEC-026 alternative in use, DEC-010, DEC-011). Optional: a failure just hides the extra note. */
export function useAttendanceFlags(enabled = true) {
  return useSWR(enabled ? attendancePaths.settings : null, getAttendanceFlags, { revalidateOnFocus: false, shouldRetryOnError: false });
}

export const useMyWorkList = () => useSWR(myDayPaths.workList, getMyWorkList);
export const useMyTargets = () => useSWR(`${myDayPaths.targets}?scope=self`, getMyTargets);

/**
 * The running time of a session in seconds. For an open session it ticks once a second from the effective
 * check-in (server time is the only clock; the client only displays it); a closed session returns its span.
 */
export function useElapsedSeconds(session: AttendanceSessionDto | null | undefined): number {
  const open = session?.state === 'open';
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [open]);
  if (!session) return 0;
  if (session.effectiveCheckOutAt) return Math.max(0, (Date.parse(session.effectiveCheckOutAt) - Date.parse(session.effectiveCheckInAt)) / 1000);
  return Math.max(0, (now - Date.parse(session.effectiveCheckInAt)) / 1000);
}
