'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { resolveGuardRedirect } from '@/lib/authRoutes';
import { useSessionEnded } from '@/lib/sessionEndedSignal';
import { SessionEndedDialog } from '@/components/states/SessionEnded';
import { OfflineBanner } from '@/components/states/SystemStates';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileHeader, MobileTabBar } from './MobileNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, isOwner2faPending, sessionState } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const ended = useSessionEnded();
  const [endedDialogOpen, setEndedDialogOpen] = useState(true);

  // Shell-level guard (second line behind src/proxy.ts): signed-out users go to login,
  // pending-2FA Owners go to the 2FA step. The backend still enforces every API call.
  // Once a session ends mid-page (SHR-013), the in-app dialog takes over and the page stays put.
  const redirectTarget = isLoading || ended
    ? null
    : resolveGuardRedirect(pathname, typeof window === 'undefined' ? '' : window.location.search, sessionState);
  const here = typeof window === 'undefined' ? pathname : window.location.pathname + window.location.search;

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if ((isLoading && !ended) || redirectTarget) {
    return (
      <div className="min-h-screen bg-[var(--surface-page)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icon name="spinner" size={36} className="text-[var(--brand-accent)] animate-spin" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">Loading session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-page text-text-primary font-sans">
      {/* Desktop Sidebar (w-56 wide) */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop Header (64px high) */}
        <div className="hidden md:block">
          <Header />
        </div>

        {/* Mobile Header (56px high) */}
        <MobileHeader />

        {/* R-11: Owner 2FA pending → restricted session until 2FA is completed */}
        {isOwner2faPending && (
          <div className="bg-status-warning-bg border-b border-status-warning-border px-6 py-3 flex items-center justify-between text-xs text-status-warning-fg">
            <div className="flex items-center gap-2.5">
              <Icon name="alert-triangle" size={16} className="text-status-warning-fg shrink-0" />
              <span>
                <strong>Restricted Owner session:</strong> You must complete 2FA authentication to access business records, calling lists, deals, and reports.
              </span>
            </div>
            <Link href="/login?step=2fa">
              <Button size="sm" variant="secondary" leadingIcon={<Icon name="lock" size={14} />}>
                Complete 2FA Challenge
              </Button>
            </Link>
          </div>
        )}

        {/* Session ended after the dialog was dismissed: keep a way back in on screen. */}
        {ended && !endedDialogOpen && (
          <div role="alert" className="bg-status-warning-bg border-b border-status-warning-border px-6 py-3 flex items-center justify-between gap-3 text-xs text-status-warning-fg">
            <span>Your session has ended. Nothing more is saved until you sign in again.</span>
            <Button size="sm" variant="secondary" onClick={() => setEndedDialogOpen(true)}>
              Sign in again
            </Button>
          </div>
        )}

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <OfflineBanner className="mb-4" />
          {children}
        </main>

        {/* Mobile Bottom Tab Bar (64px high) */}
        <MobileTabBar />
      </div>
      {ended && (
        <SessionEndedDialog isOpen={endedDialogOpen} reason={ended} redirect={here} onClose={() => setEndedDialogOpen(false)} />
      )}
    </div>
  );
}
