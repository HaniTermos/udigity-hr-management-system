import React from 'react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { cn } from '@/lib/utils';

/**
 * Split layout for SCR-AUTH-001..004: brand panel on the left (desktop), form card on the right.
 * On phones the brand panel collapses to the logo above the card. Tokens only; dark mode is navy.
 */
export function AuthShell({
  children,
  wide = false,
  footer = 'Need access? Ask the Owner/Admin.',
}: {
  children: React.ReactNode;
  wide?: boolean;
  footer?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface-page text-text-primary font-sans">
      <aside className="hidden lg:flex lg:w-5/12 shrink-0 flex-col justify-between bg-surface-brand text-text-on-brand p-16">
        <BrandLogo surface="on-brand" size="md" priority />
        <div>
          <h2 className="text-[32px] leading-10 font-bold tracking-tight">Udigity Management System</h2>
          <p className="mt-3 text-sm text-text-on-brand-muted">Attendance, businesses, calls and projects in one place.</p>
        </div>
        <div>
          <div aria-hidden className="h-0.5 w-12 bg-brand-accent mb-3" />
          <p className="text-xs text-text-on-brand-muted">Internal system · authorised Udigity staff only</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="lg:hidden w-full max-w-[440px] mb-4">
          <BrandLogo surface="default" size="sm" priority />
        </div>
        <div
          className={cn(
            'w-full bg-surface-default border border-border-default rounded-2xl p-5 sm:p-5 shadow-elevation-1',
            wide ? 'max-w-[520px]' : 'max-w-[440px]'
          )}
        >
          {children}
        </div>
        <p className="mt-4 text-xs text-text-muted text-center">© 2026 Udigity · {footer}</p>
      </main>
    </div>
  );
}

/** Session-state chip above the title ("Pending 2FA · admin locked"). */
export function SessionChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-xs font-medium bg-status-warning-bg border-status-warning-border text-status-warning-fg">
      <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-status-warning-solid" />
      {children}
    </span>
  );
}

export function AuthTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold leading-7 text-text-primary">{children}</h1>
      {sub && <p className="text-sm text-text-secondary">{sub}</p>}
    </div>
  );
}
