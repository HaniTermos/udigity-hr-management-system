import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumb `Businesses › Peak Fitness Gym › Edit`. The last crumb is the current page. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] leading-[18px] text-text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {c.href && !last ? (
                <Link href={c.href} className="text-text-link underline underline-offset-2 hover:no-underline truncate">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className="text-text-secondary truncate">
                  {c.label}
                </span>
              )}
              {!last && <Icon name="chevron-right" size={14} className="shrink-0 text-icon-muted" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Page title block shared by the Data Entry screens: optional breadcrumb, h1, a subtitle line followed by policy
 * chips, and an actions slot at the right.
 */
export function PageHeader({
  title,
  subtitle,
  chips,
  breadcrumb,
  actions,
  meta,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  chips?: React.ReactNode;
  breadcrumb?: Crumb[];
  actions?: React.ReactNode;
  /** Extra line under the title (tag, attribution, flag). */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start justify-between gap-3', className)}>
      <div className="min-w-0 flex flex-col gap-1">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        <h1 className="ds-h1 text-text-primary [overflow-wrap:anywhere]">{title}</h1>
        {meta}
        {(subtitle || chips) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {subtitle && <p className="text-[13px] leading-[18px] text-text-secondary">{subtitle}</p>}
            {chips}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
