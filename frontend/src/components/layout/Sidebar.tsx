'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Icon } from '@/components/ui/Icon';
import { useCapabilityCheck } from '@/lib/hooks/useCapability';
import { activeHref, PROFILE_ITEM, visibleSections, type NavItemDef } from '@/lib/nav';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const allowed = useCapabilityCheck();

  // Role subtitle for sidebar header
  const roleDisplay =
    user?.role === 'owner'
      ? 'Owner / Admin'
      : user?.role === 'data_entry'
        ? 'Data Entry'
        : user?.role === 'developer'
          ? 'Developer'
          : 'Call Center';

  // Capability-driven: items appear only when `/me` grants their action (lib/nav.ts).
  const sections = visibleSections(allowed);
  const current = activeHref(pathname, [...sections.flatMap((s) => s.items), PROFILE_ITEM]);

  return (
    <aside className="w-56 shrink-0 bg-[var(--surface-brand)] text-[var(--text-on-brand)] flex flex-col h-screen border-r border-border-on-brand select-none">
      {/* Sidebar Header matching Figma: Udigity MS \n Call Center */}
      <div className="pt-5 pb-4 px-5 border-b border-border-on-brand">
        <Link href="/my-day" className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded">
          <BrandLogo surface="on-brand" size="sm" priority />
          <div className="text-[12px] text-[var(--text-on-brand-muted)] font-normal mt-1.5">
            {roleDisplay}
          </div>
        </Link>
      </div>

      {/* Nav items list (capability-driven) */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto py-4 px-3 space-y-4 text-xs">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-2.5 pb-1 ds-overline text-text-on-brand-muted">{section.title}</div>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} active={current === item.href} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer Pinned Nav: My Profile */}
      <div className="p-3 border-t border-border-on-brand">
        <SidebarLink item={PROFILE_ITEM} active={current === PROFILE_ITEM.href} />
      </div>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItemDef; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        active
          ? 'bg-surface-brand-active text-text-on-brand font-semibold'
          : 'text-text-on-brand-muted hover:bg-surface-brand-hover hover:text-text-on-brand'
      )}
    >
      {active && <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-brand-accent" />}
      <Icon name={item.icon} size={18} className={active ? 'text-icon-on-brand-active' : 'text-icon-on-brand'} />
      <span className="truncate">{item.name}</span>
    </Link>
  );
}
