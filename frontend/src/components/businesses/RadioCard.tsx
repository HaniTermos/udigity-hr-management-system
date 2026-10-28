import React from 'react';
import { cn } from '@/lib/utils';

/** Figma `RadioCard`: a native radio inside a bordered card. The description fills the card (no narrow wrap). */
export function RadioCard({
  name,
  value,
  checked,
  disabled,
  title,
  description,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        'focus-within:ring-2 focus-within:ring-focus-ring',
        checked ? 'border-border-brand bg-brand-accent-subtle' : 'border-border-default bg-surface-default',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-surface-hover'
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--brand-primary)] cursor-[inherit]"
      />
      <span className="min-w-0 flex-1 flex flex-col">
        <span className="text-sm font-medium leading-5 text-text-primary">{title}</span>
        <span className="text-[13px] leading-[18px] text-text-secondary">{description}</span>
      </span>
    </label>
  );
}
