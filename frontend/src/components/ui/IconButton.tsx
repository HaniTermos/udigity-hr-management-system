import React from 'react';
import { cn } from '@/lib/utils';
import { Icon, IconName } from './Icon';

/**
 * Figma `IconButton` (45:405): Variant Ghost | Secondary | Primary × Size Small 32 | Medium 40 | Touch 44 (CR-DE-1).
 * Always has an accessible name (`label`). Use `touch` for every mobile icon button and Dialog/Drawer close.
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string; // accessible aria-label
  variant?: 'ghost' | 'secondary' | 'primary';
  size?: 'sm' | 'md' | 'touch';
  showDot?: boolean;
}

const VARIANTS = {
  ghost:
    'bg-transparent text-icon-default hover:bg-surface-hover active:bg-surface-pressed disabled:text-icon-disabled disabled:bg-transparent',
  secondary:
    'bg-surface-default text-icon-default border border-border-strong hover:bg-surface-hover active:bg-surface-pressed ' +
    'disabled:bg-surface-disabled disabled:text-icon-disabled disabled:border-border-default',
  primary:
    'bg-brand-primary text-icon-on-primary hover:bg-brand-primary-hover active:bg-brand-primary-pressed ' +
    'disabled:bg-surface-disabled disabled:text-icon-disabled',
} as const;

const SIZES = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  touch: 'w-11 h-11 min-w-[44px] min-h-[44px]',
} as const;

const ICON_SIZES = { sm: 16, md: 20, touch: 20 } as const;

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, label, variant = 'ghost', size = 'md', showDot = false, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        className={cn(
          'relative inline-flex items-center justify-center rounded-md transition-colors select-none cursor-pointer active:scale-[0.95]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-default',
          'disabled:cursor-not-allowed disabled:active:scale-100',
          VARIANTS[variant],
          SIZES[size],
          className
        )}
        {...props}
      >
        <Icon name={icon} size={ICON_SIZES[size]} />
        {showDot && (
          <span
            aria-hidden
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-status-danger-solid ring-2 ring-surface-default"
          />
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
