'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Icon } from '@/components/ui/Icon';
import { useCapabilityCheck } from '@/lib/hooks/useCapability';
import { activeHref, mobileTabs, titleForPath } from '@/lib/nav';

export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const title = titleForPath(pathname);
  // Detail pages (two or more path segments) can go back; top-level pages cannot.
  const canGoBack = pathname.split('/').filter(Boolean).length > 1;

  return (
    <header className="md:hidden h-14 bg-surface-default border-b border-border-default px-4 flex items-center justify-between gap-2 sticky top-0 z-40 select-none">
      <div className="flex items-center gap-1 -ml-2 min-w-0">
        {canGoBack && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.back()}
            className="w-11 h-11 inline-flex items-center justify-center rounded-md text-icon-default hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Icon name="chevron-left" size={20} />
          </button>
        )}
        <span className={cn('font-semibold text-base text-text-primary leading-6 truncate', !canGoBack && 'pl-2')}>{title}</span>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        {user && <Avatar name={user.fullName} size="sm" aria-hidden />}
      </div>
    </header>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const allowed = useCapabilityCheck();
  const tabs = mobileTabs(allowed);
  const current = activeHref(pathname, tabs);

  return (
    <nav aria-label="Main" className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-default border-t border-border-default flex items-center justify-around px-2 z-40 select-none">
      {tabs.map((tab) => {
        const isActive = current === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 gap-0.5 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              isActive ? 'text-brand-accent-strong font-semibold' : 'text-text-muted font-normal hover:text-text-primary'
            )}
          >
            <Icon name={tab.icon} size={20} />
            <span className="text-[10px] leading-tight tracking-tight">{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
