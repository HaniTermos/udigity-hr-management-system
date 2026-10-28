'use client';

import { useSyncExternalStore } from 'react';
import type { SessionEndReason } from '@/lib/errorRouting';

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

/** Cleared on a full navigation (sign-in), and by tests. */
export function resetSessionEnded(): void {
  current = null;
  listeners.forEach((l) => l());
}

export function useSessionEnded(): SessionEndReason | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
