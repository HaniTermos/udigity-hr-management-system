'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';

/** Page frame for the Developer screens. The ToastProvider lives in the root layout. */
export function DeliveryFrame({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
