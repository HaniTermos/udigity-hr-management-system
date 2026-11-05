'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AttendanceCorrections } from '@/components/owner/AttendanceCorrections';

/** SCR-OWN-005 Attendance corrections & review queue (Owner). */
export default function AttendanceCorrectionsPage() {
  return (
    <AppShell>
      <AttendanceCorrections />
    </AppShell>
  );
}
