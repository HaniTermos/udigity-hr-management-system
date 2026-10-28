import React from 'react';
import Image from 'next/image';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** `on-brand` = navy surfaces (sidebar): reversed lockup. `default` = light surfaces. */
  surface?: 'default' | 'on-brand';
  className?: string;
  priority?: boolean;
}

// Source: assets/logo/udigity-lockup-horizontal{,-reversed}.png (465x128), copied to public/brand/.
const LOCKUP = {
  default: '/brand/udigity-lockup-horizontal.png',
  'on-brand': '/brand/udigity-lockup-horizontal-reversed.png',
} as const;

const HEIGHTS = { sm: 24, md: 32, lg: 44 } as const;

export function BrandLogo({ size = 'md', surface = 'on-brand', className = '', priority = false }: BrandLogoProps) {
  const height = HEIGHTS[size];
  const width = Math.round((465 / 128) * height);
  return (
    <Image
      src={LOCKUP[surface]}
      alt="Udigity"
      width={width}
      height={height}
      priority={priority}
      className={`select-none ${className}`}
      style={{ width, height: 'auto' }}
    />
  );
}
