'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { CallingAssignments } from '@/components/owner/CallingAssignments';

/** SCR-OWN-007 Calling assignments (+ SCR-OWN-008 reassignment impact dialog). Owner + 2FA; enforced by the API. */
export default function CallingAssignmentsPage() {
  return (
    <AppShell>
      <CallingAssignments />
    </AppShell>
  );
}
