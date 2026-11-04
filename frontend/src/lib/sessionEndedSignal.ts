'use client';

import { useSyncExternalStore } from 'react';
import { sessionEndReasonFor, type SessionEndReason } from '@/lib/sessionEndReason';

/*
 * SHR-013 in-app dialog: a 401 on a page inside the app shell raises this signal instead of
 * navigating away, so the page (and what the user typed) stays on screen behind the dialog.
 * Without a mounted listener (no AppShell) the caller falls back to the /session-ended page.
 */

let current: SessionEndReason | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Raises the signal. Returns false when nothing is listening, so the caller can navigate instead. */
export function signalSessionEnded(reason: SessionEndReason): boolean {
  if (listeners.size === 0) return false;
  if (current === null) {
    current = reason;
    listeners.forEach((l) => l());
  }
  return true;
}

/**
 * True once `/api/auth/me` has returned a signed-in user in this page load. A 401 after that means the session was
 * lost while the user was working (A-01), as opposed to a visitor who was never signed in.
 */
let hadSession = false;
export function markSessionKnown(known: boolean): void {
  hadSession = known;
}

/** Pages that are meant to be used signed out: a 401 there is just a failed form. */
function onPublicPage(): boolean {
  if (typeof window === 'undefined') return true;
  const p = window.location.pathname;
  return ['/login', '/reset-password', '/session-ended'].some((x) => p === x || p.startsWith(x + '/'));
}

/** Called by the API client on any 401 (and by the session fetch). Raises the dialog only for a session that was working. */
export function signalSessionLost(code?: string): boolean {
  if (!hadSession || onPublicPage()) return false;
  return signalSessionEnded(sessionEndReasonFor(code));
}

/** Cleared on a full navigation (sign-in), and by tests. */
export function resetSessionEnded(): void {
  current = null;
  listeners.forEach((l) => l());
}

export function useSessionEnded(): SessionEndReason | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
