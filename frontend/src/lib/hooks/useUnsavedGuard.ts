'use client';

import { useEffect } from 'react';

export const LEAVE_PAGE_MESSAGE = 'You have unsaved changes. Leave this page and lose them?';

/**
 * True when a click on `anchor` would leave the current page inside the app (same origin, another path, same tab,
 * no modifier key). Pure, so it can be unit-tested without a DOM.
 */
export function isInAppLeave(
  anchor: { href: string; target?: string; download?: boolean | string } | null,
  event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean },
  location: { origin: string; pathname: string; search: string }
): boolean {
  if (!anchor || event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (Boolean(anchor.download) || (anchor.target && anchor.target !== '_self')) return false;
  let url: URL;
  try {
    url = new URL(anchor.href, location.origin);
  } catch {
    return false;
  }
  if (url.origin !== location.origin) return false;
  return url.pathname !== location.pathname || url.search !== location.search;
}

/**
 * While `active` (the form has unsaved input): the browser confirms closing or reloading the tab, and following
 * an in-app link asks first (B-15; the browser Back button inside the app is not intercepted, it would need a history sentinel). Links are intercepted in the capture phase, before Next's
 * router handles them.
 */
export function useUnsavedGuard(active: boolean, message: string = LEAVE_PAGE_MESSAGE) {
  useEffect(() => {
    if (!active) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!isInAppLeave(el, e, window.location)) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active, message]);
}
