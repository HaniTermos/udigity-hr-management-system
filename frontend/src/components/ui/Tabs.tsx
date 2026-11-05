import React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  style?: 'underline' | 'segmented';
  className?: string;
}

export function Tabs({
  items,
  activeId,
  onChange,
  style = 'underline',
  className = '',
}: TabsProps) {
  if (style === 'segmented') {
    return (
      <div
        role="tablist"
        className={cn(
          'inline-flex items-center p-1 rounded-lg bg-surface-sunken border border-border-subtle text-sm select-none',
          className
        )}
      >
        {items.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                'h-8 px-3 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                isActive
                  ? 'bg-surface-default text-text-primary shadow-elevation-1 font-medium'
                  : 'text-text-secondary hover:bg-surface-hover',
                tab.disabled && 'text-text-disabled pointer-events-none'
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={cn(
                    'min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                    isActive
                      ? 'bg-status-brand-solid text-text-on-primary'
                      : 'bg-status-neutral-bg text-status-neutral-fg'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Underline style
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-6 border-b border-border-default text-sm select-none overflow-x-auto',
        className
      )}
    >
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              'h-10 px-1 -mb-px border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              isActive
                ? 'border-brand-accent text-text-primary font-medium'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong',
              tab.disabled && 'text-text-disabled pointer-events-none'
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                  isActive
                    ? 'bg-status-brand-solid text-text-on-primary'
                    : 'bg-status-neutral-bg text-status-neutral-fg'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
