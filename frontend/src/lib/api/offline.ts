/**
 * SCR-SHR-015 offline saves (UDI-18). Pure module: no React, so the transport and unit tests share it.
 *
 * - While the browser reports no connection, a mutation (POST/PUT/PATCH/DELETE) is NOT sent: the
 *   transport answers with status 0 / `OFFLINE` and the message below. Reads (GET) are never blocked.
 * - When a mutation's fetch itself fails (the connection dropped mid-save), the message says it was not
 *   saved and the input is kept. Nothing is retried automatically: the user presses Save again and the
 *   same idempotency key keeps a retry from duplicating the write.
 * Forms show `ApiError.message`, so both cases reach the user without touching each form.
 */

export const MUTATING_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Not sent: the browser was offline before the request left. */
export const OFFLINE_NOT_SENT_MESSAGE =
  'Not saved: you’re offline, so nothing was sent. Your input is kept on this page. Try again when your connection returns.';

/** Sent, but the connection dropped before an answer arrived. */
export const CONNECTION_LOST_MESSAGE =
  'Not saved: the connection dropped. Your input is kept on this page. Try again when your connection returns.';

export const OFFLINE_CODE = 'OFFLINE';
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

export function isMutatingMethod(method: string | undefined): boolean {
  return MUTATING_METHODS.has((method || 'GET').toUpperCase());
}

/** `true` only when the browser says it is offline (`navigator.onLine === false`); unknown counts as online. */
export function browserIsOffline(nav: { onLine?: boolean } | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  return nav?.onLine === false;
}

/** The error body for a mutation blocked before sending, or null when the request may go. */
export function offlineBlock(method: string | undefined, offline: boolean): { error: string; code: string } | null {
  if (!offline || !isMutatingMethod(method)) return null;
  return { error: OFFLINE_NOT_SENT_MESSAGE, code: OFFLINE_CODE };
}

/** The error body when fetch itself failed: saves say "not saved", reads keep the plain network error. */
export function networkFailure(method: string | undefined): { error: string; code: string } {
  return isMutatingMethod(method)
    ? { error: CONNECTION_LOST_MESSAGE, code: NETWORK_ERROR_CODE }
    : { error: 'Network error', code: NETWORK_ERROR_CODE };
}
