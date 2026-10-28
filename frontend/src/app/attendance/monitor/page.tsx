'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AttendanceMonitor } from '@/components/owner/AttendanceMonitor';

/** SCR-OWN-004 Attendance monitoring & exception alerts (Owner). */
export default function AttendanceMonitorPage() {
  return (
    <AppShell>
      <AttendanceMonitor />
    </AppShell>
  );
}
