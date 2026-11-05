'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';
import { setDeliveryTimeZone } from './shared';

/** Page frame for the Developer screens. The ToastProvider lives in the root layout. */
export function DeliveryFrame({ children }: { children: React.ReactNode }) {
  // Set during render so the children's first paint already uses the company zone.
  setDeliveryTimeZone(useCompanyTime().timezone);
  return <AppShell>{children}</AppShell>;
}
