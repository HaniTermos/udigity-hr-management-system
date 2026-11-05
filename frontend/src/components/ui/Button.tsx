'use client';

import React from 'react';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/**
 * Figma `Button` (45:305): Variant Primary | Secondary | Ghost | Destructive × Size Small 32 | Medium 40 | Large 48
 * × State Default | Hover | Focus | Disabled | Loading. `touch` = 44 px min (CR-DE-1); `link` = Figma `Link`.
 * SHR-015 offline: a `type="submit"` button is disabled and reads "Save (offline)" while the browser is offline
 * (`allowOffline` opts out). Other save buttons are covered by the transport (lib/api/offline.ts).
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'touch';
  fullWidth?: boolean;
  isLoading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** Keep a submit button enabled while offline (e.g. a form that only filters or searches locally). */
  allowOffline?: boolean;
}

const BASE =
  'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-150 select-none cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-default ' +
  'active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100';

const VARIANTS = {
  primary:
    'bg-brand-primary text-text-on-primary hover:bg-brand-primary-hover active:bg-brand-primary-pressed ' +
    'disabled:bg-surface-disabled disabled:text-text-disabled',
  secondary:
    'bg-surface-default text-text-primary border border-border-strong hover:bg-surface-hover active:bg-surface-pressed ' +
    'disabled:bg-surface-disabled disabled:text-text-disabled disabled:border-border-default',
  ghost:
    'bg-transparent text-text-primary hover:bg-surface-hover active:bg-surface-pressed disabled:text-text-disabled disabled:bg-transparent',
  destructive:
    'bg-status-danger-solid text-text-on-danger hover:bg-status-danger-fg ' +
    'disabled:bg-surface-disabled disabled:text-text-disabled',
  link:
    'bg-transparent text-text-link underline-offset-4 hover:underline p-0 h-auto font-medium active:scale-100 disabled:text-text-disabled disabled:no-underline',
} as const;

const SIZES = {
  sm: 'h-8 px-3 text-xs leading-4 gap-1.5', // Small 32 · ds/Label Small · icon 16
  md: 'h-10 px-4 text-sm leading-5 gap-2', // Medium 40 · ds/Label · icon 20
  lg: 'h-12 px-5 text-sm leading-5 gap-2', // Large 48 · ds/Label · mobile full-width actions
  touch: 'h-11 min-h-[44px] min-w-[44px] px-4 text-sm leading-5 gap-2', // CR-DE-1 44×44
} as const;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      allowOffline = false,
      type,
      ...props
    },
    ref
  ) => {
    const online = useOnlineStatus();
    const offlineBlocked = type === 'submit' && !allowOffline && !online;
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading || offlineBlocked}
        aria-busy={isLoading || undefined}
        className={cn(
          BASE,
          VARIANTS[variant],
          variant !== 'link' && SIZES[size],
          isLoading && 'disabled:cursor-progress',
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading && <Icon name="spinner" size={size === 'sm' ? 16 : 20} className="animate-spin shrink-0" />}
        {!isLoading && leadingIcon && <span className="shrink-0 inline-flex">{leadingIcon}</span>}
        <span>
          {children}
          {offlineBlocked && ' (offline)'}
        </span>
        {!isLoading && trailingIcon && <span className="shrink-0 inline-flex">{trailingIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
