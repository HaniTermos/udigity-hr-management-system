/**
 * Navigation model (plan.md §9, SCR shell). One list for every role: an item is shown when the user
 * has its `action` capability (from `/me`, see lib/hooks/useCapability.ts). Items without an action are
 * available to every signed-in user. The server still decides every request.
 *
 * `built: false` marks routes that are planned (plan.md §3.2) but have no page yet; they stay out of
 * the menu until the owning agent ships the route, so nothing links to a 404 (QA-4).
 */
import type { IconName } from '@/components/ui/Icon';
import { ACTIONS } from '@/lib/actions';

export interface NavItemDef {
  name: string;
  href: string;
  icon: IconName;
  /** Capability required to see the item. Omit for "everyone". */
  action?: string;
  built?: boolean;
  /** Candidate for the mobile tab bar (lower number first). */
  mobilePriority?: number;
}

export interface NavSectionDef {
  title: string;
  items: NavItemDef[];
}

export const NAV_SECTIONS: NavSectionDef[] = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'Dashboard', href: '/', icon: 'home', action: ACTIONS.dashboardOwnerRead, mobilePriority: 0 },
      { name: 'My Day', href: '/my-day', icon: 'clock' },
      { name: 'My Attendance', href: '/my-attendance', icon: 'check-circle' },
      { name: 'Notifications', href: '/notifications', icon: 'bell', action: ACTIONS.notificationList, built: true },
    ],
  },
  {
    title: 'PEOPLE & ADMIN',
    items: [
      { name: 'Attendance', href: '/attendance/monitor', icon: 'users', action: ACTIONS.attendanceCorrectionReview },
      { name: 'Employees', href: '/employees', icon: 'users', action: ACTIONS.employeeList, mobilePriority: 6 },
      { name: 'Targets & Work Lists', href: '/targets', icon: 'target', action: ACTIONS.targetSet },
      { name: 'Calling Assignments', href: '/calling-assignments', icon: 'phone', action: ACTIONS.callingAssign },
      { name: 'Reports & Exports', href: '/reports', icon: 'file-text', action: ACTIONS.reportRead },
      { name: 'Delivery Monitor', href: '/delivery-monitor', icon: 'list', action: ACTIONS.reminderMonitorRead, built: true },
      { name: 'Audit', href: '/audit', icon: 'shield', action: ACTIONS.auditRead },
      { name: 'Roles & Permissions', href: '/settings/roles', icon: 'lock', action: ACTIONS.roleList },
      { name: 'Settings', href: '/settings', icon: 'settings', action: ACTIONS.settingsRead },
    ],
  },
  {
    title: 'BUSINESSES',
    items: [
      { name: 'Businesses', href: '/businesses', icon: 'building', action: ACTIONS.businessList, mobilePriority: 3 },
      { name: 'Add Business', href: '/businesses/new', icon: 'plus', action: ACTIONS.businessCreate },
      { name: 'Correction Requests', href: '/corrections', icon: 'edit', action: ACTIONS.correctionRead, mobilePriority: 7 },
      { name: 'Categories', href: '/categories', icon: 'list', action: ACTIONS.categoryList },
    ],
  },
  {
    title: 'CALLING',
    items: [
      { name: 'Calling Queue', href: '/queue', icon: 'phone', action: ACTIONS.callingQueueRead, mobilePriority: 1 },
      { name: 'Follow-ups & Calendar', href: '/calendar', icon: 'calendar', action: ACTIONS.followUpRead, mobilePriority: 2 },
      // D15 (approved): Owner only; Call Center is refused (assigned Developer works from Deals).
      { name: 'Opportunities & Handoffs', href: '/opportunities', icon: 'briefcase', action: ACTIONS.opportunitiesList },
      { name: 'Do-not-call List', href: '/do-not-call', icon: 'ban', action: ACTIONS.callingQueueRead },
    ],
  },
  {
    title: 'DELIVERY',
    items: [
      { name: 'Deals', href: '/deals', icon: 'briefcase', action: ACTIONS.dealRead, mobilePriority: 4 },
      { name: 'Meetings & Calendar', href: '/meetings', icon: 'calendar', action: ACTIONS.meetingRead, mobilePriority: 5 },
      { name: 'Projects', href: '/projects', icon: 'board', action: ACTIONS.projectRead },
    ],
  },
];

export const PROFILE_ITEM: NavItemDef = { name: 'My Profile', href: '/profile', icon: 'user' };

/** Visible sections for a capability checker; empty sections are dropped. */
export function visibleSections(allowed: (action: string | undefined) => boolean): NavSectionDef[] {
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.built !== false && allowed(i.action)),
  })).filter((s) => s.items.length > 0);
}

/** The one item that is "current": the most specific href that matches the path. */
export function activeHref(pathname: string, items: NavItemDef[]): string | null {
  let best: string | null = null;
  for (const { href } of items) {
    if (pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

/** Mobile tabs: My Day, up to two role-relevant destinations, then More (profile). */
export function mobileTabs(allowed: (action: string | undefined) => boolean): NavItemDef[] {
  const candidates = NAV_SECTIONS.flatMap((s) => s.items)
    .filter((i) => i.mobilePriority !== undefined && i.built !== false && allowed(i.action))
    .sort((a, b) => (a.mobilePriority ?? 0) - (b.mobilePriority ?? 0))
    .slice(0, 2);
  return [
    { name: 'My Day', href: '/my-day', icon: 'clock' },
    ...candidates.map((c) => ({ ...c, name: c.name === 'Follow-ups & Calendar' ? 'Follow-ups' : c.name === 'Calling Queue' ? 'Queue' : c.name === 'Meetings & Calendar' ? 'Meetings' : c.name })),
    { name: 'More', href: '/profile', icon: 'menu' },
  ];
}

/** Title for the mobile header from the current path. */
export function titleForPath(pathname: string): string {
  const all = NAV_SECTIONS.flatMap((s) => s.items).concat(PROFILE_ITEM);
  const href = activeHref(pathname, all);
  const item = all.find((i) => i.href === href);
  return item?.name === 'Follow-ups & Calendar' ? 'Follow-ups' : item?.name ?? 'Udigity';
}
