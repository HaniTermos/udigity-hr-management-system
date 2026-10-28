import React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

/*
 * Figma `Table/HeaderCell`, `Table/Cell`, `Table/HeaderRow`, `Table/Row` (Default | Hover | Selected), `Table/Pagination`.
 * Header: surface/sunken, ds/Overline, 40 high. Body rows: 56 high, border-top border/subtle.
 * Numbers right-aligned with tabular figures. Wrap in `TableContainer` for the card frame + horizontal scroll.
 */

export function TableContainer({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-xl border border-border-default bg-surface-default', className)} {...props}>
      {children}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-sm text-text-primary', className)} {...props} />;
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-sunken', className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export type SortDirection = 'none' | 'ascending' | 'descending';

export interface THProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right';
  sort?: SortDirection;
  onSort?: () => void;
}

export function TH({ className, align = 'left', sort, onSort, children, ...props }: THProps) {
  const content = (
    <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
      <span>{children}</span>
      {sort && sort !== 'none' && <Icon name={sort === 'ascending' ? 'arrow-up' : 'arrow-down'} size={14} className="text-icon-default" />}
    </span>
  );
  return (
    <th
      scope="col"
      aria-sort={sort}
      className={cn(
        'h-10 px-3 ds-overline text-text-muted whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
        className
      )}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center rounded-xs cursor-pointer hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  );
}

export interface TRProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  interactive?: boolean;
}

export function TR({ className, selected, interactive = true, ...props }: TRProps) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        'border-t border-border-subtle transition-colors',
        interactive && 'hover:bg-surface-hover',
        selected && 'bg-surface-selected hover:bg-surface-selected',
        className
      )}
      {...props}
    />
  );
}

export interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  /** Secondary line under the main text (Table/Cell Type=Text with meta). */
  meta?: React.ReactNode;
}

export function TD({ className, numeric, meta, children, ...props }: TDProps) {
  return (
    <td
      className={cn('h-14 px-3 align-middle', numeric && 'text-right tabular-nums', className)}
      {...props}
    >
      {meta ? (
        <div className="flex flex-col">
          <span className="font-medium leading-5">{children}</span>
          <span className="text-[13px] leading-[18px] text-text-muted">{meta}</span>
        </div>
      ) : (
        children
      )}
    </td>
  );
}

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** e.g. "Showing 1–10 of 248" */
  rangeLabel?: string;
  /** e.g. "10 per page" or a Select element */
  perPage?: React.ReactNode;
  className?: string;
}

function pageList(page: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, 2, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pageCount, onPageChange, rangeLabel, perPage, className }: PaginationProps) {
  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center gap-3 px-3 py-2 bg-surface-default border-t border-border-subtle text-[13px] text-text-secondary', className)}
    >
      {rangeLabel && <span className="tabular-nums">{rangeLabel}</span>}
      <span className="flex-1" />
      <IconButton icon="chevron-left" label="Previous page" variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
      <div className="flex items-center gap-1">
        {pageList(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="w-8 text-center text-text-muted" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={cn(
                'w-8 h-8 rounded-md text-xs font-medium tabular-nums cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                p === page ? 'bg-brand-primary text-text-on-primary' : 'text-text-primary hover:bg-surface-hover'
              )}
            >
              {p}
            </button>
          )
        )}
      </div>
      <IconButton icon="chevron-right" label="Next page" variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} />
      {perPage && <span>{perPage}</span>}
    </nav>
  );
}
