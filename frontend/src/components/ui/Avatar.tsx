import React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'brand' | 'neutral';
}

export function Avatar({
  name,
  size = 'md',
  tone = 'brand',
  className,
  ...props
}: AvatarProps) {
  const getInitials = (n: string) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const sizes = {
    sm: 'w-6 h-6 text-[10px]', // Small 24
    md: 'w-8 h-8 text-xs',     // Medium 32 · ds/Label Small
    lg: 'w-10 h-10 text-sm',   // Large 40 · ds/Label
  };

  const tones = {
    brand: 'bg-status-brand-bg text-status-brand-fg', // Figma Avatar Tone=Brand
    neutral: 'bg-status-neutral-bg text-status-neutral-fg',
  };

  return (
    <div
      className={cn(
        'rounded-full font-medium flex items-center justify-center shrink-0 select-none tabular-nums',
        sizes[size],
        tones[tone],
        className
      )}
      {...props}
    >
      {getInitials(name)}
    </div>
  );
}
