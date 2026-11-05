/**
 * Polling policy (review F-03 / B-07). Pure module so it can be unit-tested.
 *
 * - No interval by default: screens refresh on mount, on focus and after their own writes.
 * - A screen that shows live data opts in with an explicit interval (calling queue, notification badge...).
 * - SWR itself pauses interval refreshes while the tab is hidden or the browser is offline
 *   (`refreshWhenHidden` / `refreshWhenOffline` stay false, see useApi).
 * - A key that answered 401/403/404 is not polled again: the answer will not change by asking more often.
 */
export const DEFAULT_POLL_MS = 0;

/** Statuses after which polling the same key is pointless. */
export function stopsPolling(status: number | undefined): boolean {
  return status === 401 || status === 403 || status === 404;
}

/** The interval to use now: 0 when the key is blocked by an earlier 401/403/404. */
export function effectivePollMs(base: number | undefined, blockedStatus: number | undefined): number {
  if (stopsPolling(blockedStatus)) return 0;
  return base && base > 0 ? base : 0;
}
