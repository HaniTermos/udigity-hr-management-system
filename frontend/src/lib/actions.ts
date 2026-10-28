/**
 * The one list of action names the UI asks about (CR1-01). They are the authz-matrix names
 * (docs/security/authz-matrix.md, backend `modules/access/matrix.ts`) and the same strings `GET /api/auth/me`
 * returns in `capabilities`. Nav, `useCapability`, `can()` and `useBusinessAccess` all import this module;
 * `actions.test.ts` diffs it against the backend matrix so a rename cannot drift silently.
 */
export const ACTIONS = {
  // identity / employees / admin
  employeeList: 'employee.list',
  roleList: 'role.list',
  settingsRead: 'settings.read',
  auditRead: 'audit.read',
  // attendance
  attendanceRead: 'attendance.read',
  attendanceCheckIn: 'attendance.check_in',
  attendanceCheckOut: 'attendance.check_out',
  attendanceCorrectionRequest: 'attendance.correction.request',
  attendanceCorrectionReview: 'attendance.correction.review',
  // work / reports / notifications
  targetRead: 'target.read',
  targetSet: 'target.set',
  reportRead: 'report.read',
  notificationList: 'notification.list',
  reminderMonitorRead: 'reminder.monitor.read',
  dashboardSelfRead: 'dashboard.self.read',
  dashboardOwnerRead: 'dashboard.owner.read',
  // businesses
  businessList: 'business.list',
  businessSearch: 'business.search',
  businessRead: 'business.read',
  businessCreate: 'business.create',
  businessUpdate: 'business.update',
  businessHistoryRead: 'business.history.read',
  businessArchive: 'business.archive',
  businessRestore: 'business.restore',
  categoryList: 'category.list',
  categoryCreate: 'category.create',
  categoryRename: 'category.rename',
  categoryDeactivate: 'category.deactivate',
  correctionSubmit: 'correction.submit',
  correctionRead: 'correction.read',
  correctionReview: 'correction.review',
  correctionWithdraw: 'correction.withdraw',
  // calling
  callingQueueRead: 'calling.queue.read',
  callingAssign: 'calling.assign',
  followUpRead: 'follow_up.read',
  // delivery
  dealRead: 'deal.read',
  meetingRead: 'meeting.read',
  projectRead: 'project.read',
} as const;

export type ActionName = (typeof ACTIONS)[keyof typeof ACTIONS];

import type { Role } from './api/types';
export type { Role };
const ALL: readonly Role[] = ['owner', 'data_entry', 'call_center', 'developer'];

/**
 * Role defaults used ONLY while `/me` carries no `capabilities` (a backend that has not sent
 * them). Once the list exists it wins and this table is ignored. Mirrors authz-matrix route actions; the server
 * still decides every call.
 */
export const ROLE_DEFAULTS: Partial<Record<ActionName, readonly Role[]>> = {
  [ACTIONS.attendanceRead]: ALL,
  [ACTIONS.attendanceCheckIn]: ALL,
  [ACTIONS.attendanceCheckOut]: ALL,
  [ACTIONS.attendanceCorrectionRequest]: ALL,
  [ACTIONS.attendanceCorrectionReview]: ['owner'],
  [ACTIONS.dashboardSelfRead]: ALL,
  [ACTIONS.notificationList]: ALL,
  [ACTIONS.employeeList]: ['owner'],
  [ACTIONS.roleList]: ['owner'],
  [ACTIONS.reportRead]: ['owner'],
  [ACTIONS.dashboardOwnerRead]: ['owner'],
  [ACTIONS.auditRead]: ['owner'],
  [ACTIONS.settingsRead]: ['owner'],
  [ACTIONS.callingAssign]: ['owner'],
  [ACTIONS.reminderMonitorRead]: ['owner'],
  [ACTIONS.targetRead]: ['owner', 'call_center'],
  [ACTIONS.targetSet]: ['owner'],
  [ACTIONS.businessList]: ['owner', 'data_entry', 'call_center'],
  [ACTIONS.businessSearch]: ALL,
  [ACTIONS.businessRead]: ALL,
  [ACTIONS.businessCreate]: ['owner', 'data_entry'],
  [ACTIONS.businessUpdate]: ['owner', 'data_entry'],
  [ACTIONS.businessHistoryRead]: ALL,
  [ACTIONS.businessArchive]: ['owner'],
  [ACTIONS.businessRestore]: ['owner'],
  [ACTIONS.categoryList]: ['owner', 'data_entry'],
  [ACTIONS.categoryCreate]: ['owner'],
  [ACTIONS.categoryRename]: ['owner'],
  [ACTIONS.categoryDeactivate]: ['owner'],
  [ACTIONS.correctionSubmit]: ['owner', 'call_center', 'developer'],
  [ACTIONS.correctionRead]: ['owner', 'data_entry'],
  [ACTIONS.correctionReview]: ['owner', 'data_entry'],
  [ACTIONS.correctionWithdraw]: ['owner', 'call_center', 'developer'],
  [ACTIONS.callingQueueRead]: ['owner', 'call_center'],
  [ACTIONS.followUpRead]: ['owner', 'call_center'],
  [ACTIONS.dealRead]: ['owner', 'developer'],
  [ACTIONS.meetingRead]: ['owner', 'developer'],
  [ACTIONS.projectRead]: ['owner', 'developer'],
};

/** Role-default check for an action name (string, since callers hold plain strings). */
export function roleDefaultAllows(action: string, role: Role | undefined): boolean {
  if (!role) return false;
  const roles = (ROLE_DEFAULTS as Record<string, readonly Role[] | undefined>)[action];
  return Boolean(roles && roles.includes(role));
}
