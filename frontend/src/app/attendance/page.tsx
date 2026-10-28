import { redirect } from 'next/navigation';

/** Compatibility: the employee's own history moved to /my-attendance; the Owner views live under /attendance/monitor. */
export default function AttendanceIndex() {
  redirect('/attendance/monitor');
}
