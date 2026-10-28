import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';

export function CallingPageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="min-w-0">
        {breadcrumb && <div className="text-[13px] leading-[18px] text-text-muted mb-0.5">{breadcrumb}</div>}
        <h1 className="text-[22px] leading-7 font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="text-[13px] leading-[18px] text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function HeaderLink({ href, icon, children }: { href: string; icon: IconName; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex">
      <Button variant="secondary" size="md" leadingIcon={<Icon name={icon} size={16} />} tabIndex={-1}>
        {children}
      </Button>
    </Link>
  );
}

export function LoadingBlock() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <div className="h-6 w-48 rounded bg-surface-skeleton animate-pulse" />
      <div className="h-40 rounded-xl bg-surface-skeleton animate-pulse" />
    </div>
  );
}
