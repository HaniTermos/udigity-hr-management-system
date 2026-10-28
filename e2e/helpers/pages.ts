/** Main pages per role for the axe sweep and the dark-mode check: [route, expected text]. */
export const OWNER_PAGES: [string, RegExp][] = [
  ['/', /Dashboard/], ['/employees', /Employees/], ['/attendance/monitor', /Attendance/], ['/calling-assignments', /Calling assignments/],
  ['/reports', /Reports/], ['/settings', /Settings/], ['/audit', /Audit/], ['/delivery-monitor', /Delivery/],
  ['/targets', /Targets/], ['/businesses', /Businesses/], ['/categories', /Categories/], ['/corrections', /Correction/],
  ['/queue', /Calling queue/], ['/calendar', /Follow-ups/], ['/deals', /Deals/], ['/meetings', /Meetings/], ['/projects', /Projects/],
  ['/my-day', /My Day/], ['/my-attendance', /Attendance/], ['/notifications', /Notifications/], ['/profile', /Profile/],
];
export const DATA_ENTRY_PAGES: [string, RegExp][] = [
  ['/my-day', /My Day/], ['/businesses', /Businesses/], ['/businesses/new', /New business/], ['/corrections', /Correction/],
];
export const CALL_CENTER_PAGES: [string, RegExp][] = [
  ['/my-day', /My Day/], ['/queue', /Calling queue/], ['/calendar', /Follow-ups/], ['/opportunities', /Opportunities/], ['/do-not-call', /Do-not-call/],
];
export const DEVELOPER_PAGES: [string, RegExp][] = [
  ['/my-day', /My Day/], ['/deals', /Deals/], ['/meetings', /Meetings/], ['/projects', /Projects/],
];
