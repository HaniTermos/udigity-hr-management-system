'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Icon } from '@/components/ui/Icon';
import { useCapabilityCheck } from '@/lib/hooks/useCapability';
import { Drawer } from '@/components/ui/Drawer';
import { activeHref, mobileTabs, PROFILE_ITEM, titleForPath, visibleSections, type NavItemDef } from '@/lib/nav';

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
  const [moreOpen, setMoreOpen] = useState(false);
  const sections = visibleSections(allowed);
  const moreCurrent = activeHref(pathname, [...sections.flatMap((s) => s.items), PROFILE_ITEM]);
  // "More" is not a page: it opens the full list of this role's destinations (approved mobile design, B-12).
  const direct = tabs.filter((t) => t.name !== 'More');
  const tabClass = (active: boolean) =>
    cn(
      'flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 gap-0.5 transition-colors rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
      active ? 'text-brand-accent-strong font-semibold' : 'text-text-muted font-normal hover:text-text-primary'
    );

  return (
    <>
      <nav aria-label="Main" className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-default border-t border-border-default flex items-center justify-around px-2 z-40 select-none">
        {direct.map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={current === tab.href ? 'page' : undefined} className={tabClass(current === tab.href)}>
            <Icon name={tab.icon} size={20} />
            <span className="text-[10px] leading-tight tracking-tight">{tab.name}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen} className={tabClass(moreOpen)}>
          <Icon name="menu" size={20} />
          <span className="text-[10px] leading-tight tracking-tight">More</span>
        </button>
      </nav>
      <Drawer isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <nav aria-label="All pages" className="space-y-5">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="ds-overline text-text-muted px-2">{section.title}</div>
              <ul>
                {section.items.map((item) => (
                  <li key={item.href}>
                    <MoreLink item={item} active={moreCurrent === item.href} onNavigate={() => setMoreOpen(false)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <ul>
            <li>
              <MoreLink item={PROFILE_ITEM} active={moreCurrent === PROFILE_ITEM.href} onNavigate={() => setMoreOpen(false)} />
            </li>
          </ul>
        </nav>
      </Drawer>
    </>
  );
}

function MoreLink({ item, active, onNavigate }: { item: NavItemDef; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 min-h-[44px] px-2 rounded-md text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        active ? 'text-brand-accent-strong font-semibold bg-surface-hover' : 'text-text-primary hover:bg-surface-hover'
      )}
    >
      <Icon name={item.icon} size={18} />
      {item.name}
    </Link>
  );
}
