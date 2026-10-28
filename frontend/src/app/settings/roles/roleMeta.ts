import type { IconName } from '@/components/ui/Icon';
import type { DataScope } from '@/lib/api/roles';

export const SCOPE_OPTIONS: { value: DataScope; label: string; desc: string; icon: IconName }[] = [
  { value: 'global', label: 'Company Wide', desc: 'Can view and modify records across the entire company', icon: 'globe' },
  { value: 'department', label: 'Department Only', desc: 'Restricted strictly to members of their assigned department', icon: 'users' },
  { value: 'assigned_only', label: 'Assigned Only', desc: 'Restricted strictly to leads, businesses, or deals assigned directly to them', icon: 'user' },
  { value: 'self', label: 'Self Only', desc: 'Can only view and interact with their own personal submissions', icon: 'lock' },
];

export const MODULE_META: Record<string, { label: string; icon: IconName; desc: string }> = {
  'Identity & Security': {
    label: 'Identity & Security',
    icon: 'shield',
    desc: 'Authentication, two-factor enrollment, security tokens, and active sign-in sessions.',
  },
  'Role & Permissions': {
    label: 'Roles & Access Control',
    icon: 'shield',
    desc: 'Custom business roles definition and granular authorization assignment.',
  },
  'People & Organization': {
    label: 'Employees & Organization',
    icon: 'users',
    desc: 'Employee directory, profiles, departments, status, and job assignments.',
  },
  'Attendance & Time Tracking': {
    label: 'Attendance & Time',
    icon: 'clock',
    desc: 'Daily office check-in, breaks, punctuality calculation, and timesheet adjustments.',
  },
  'Business Directory': {
    label: 'Business Directory',
    icon: 'briefcase',
    desc: 'Lead and client business database, categories, address updates, and corrections.',
  },
  'Calling & Outreach': {
    label: 'Calling & Outreach',
    icon: 'phone',
    desc: 'Phone dialer campaigns, call attempt logs, reservations, and scheduled follow-ups.',
  },
  'Deals & Projects': {
    label: 'Deals & Projects',
    icon: 'check-circle',
    desc: 'Commercial opportunities, pipeline stages, client meetings, and project delivery tasks.',
  },
  'Targets & Work Items': {
    label: 'Targets & Work Items',
    icon: 'calendar',
    desc: 'Monthly quotas, performance thresholds, territory assignments, and work priority.',
  },
  'Reports & Auditing': {
    label: 'Reports & Auditing',
    icon: 'file-text',
    desc: 'Executive KPIs, business intelligence metrics, audit event ledger, and data exports.',
  },
};
