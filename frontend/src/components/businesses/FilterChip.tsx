import React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/** Quick-filter chip (Figma `Chip/Filter`): a toggle, `aria-pressed` carries the state. */
export function FilterChip({
  pressed,
  disabled,
  onClick,
  children,
  removable,
  className,
}: {
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  /** Shows the small x used by the active "All (n)" chip on SCR-SHR-010. */
  removable?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[13px] leading-5 font-medium cursor-pointer transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page',
        pressed
          ? 'bg-brand-accent-subtle border-border-brand text-brand-accent-strong'
          : 'bg-surface-default border-border-default text-text-primary hover:bg-surface-hover',
        disabled && 'bg-surface-disabled border-border-default text-text-disabled cursor-not-allowed hover:bg-surface-disabled',
        className
      )}
    >
      <span>{children}</span>
      {removable && pressed && <Icon name="x" size={12} />}
    </button>
  );
}
