import React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Table, TBody, TD, TH, THead, TableContainer, TR } from '@/components/ui/Table';
import type { EmployeeRow, OpenItemsDto } from '@/lib/api/employees';
import { formatClock, formatDayTime, formatRoleName } from './format';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Open work summary (BE1-C2 `openWork`): two lines like the Figma preview. `null` counts are "not available", never 0. */
export function summarizeOpenWork(w: OpenItemsDto | undefined, role: EmployeeRow['role']): { primary: string; secondary: string; total: number } {
  if (!w) return { primary: '—', secondary: '', total: 0 };
  const n = (v: number | null) => v ?? 0;
  const total =
    n(w.assignments) + n(w.followUps) + n(w.corrections) + n(w.deals) + n(w.projects) + n(w.openTasks) + n(w.openAttendanceSessions);
  const known = [w.assignments, w.followUps, w.corrections, w.deals, w.projects, w.openTasks, w.openAttendanceSessions];
  if (known.every((v) => v === null)) return { primary: 'Not available yet', secondary: '', total: 0 };
  if (total === 0) return { primary: '—', secondary: role === 'owner' ? 'Owner' : 'None open', total: 0 };

  const primary: string[] = [];
  const secondary: string[] = [];
  let correctionsPrimary = false;
  if (n(w.assignments) > 0) primary.push(plural(n(w.assignments), 'assignment', 'assignments'));
  else if (n(w.deals) > 0 || n(w.projects) > 0) {
    if (n(w.deals) > 0) primary.push(plural(n(w.deals), 'deal', 'deals'));
    if (n(w.projects) > 0) primary.push(plural(n(w.projects), 'project', 'projects'));
  } else if (n(w.corrections) > 0) {
    primary.push(plural(n(w.corrections), 'correction', 'corrections'));
    correctionsPrimary = true;
  }
  if (n(w.assignments) > 0 && (n(w.deals) > 0 || n(w.projects) > 0)) {
    if (n(w.deals) > 0) secondary.push(plural(n(w.deals), 'deal', 'deals'));
    if (n(w.projects) > 0) secondary.push(plural(n(w.projects), 'project', 'projects'));
  }
  if (n(w.followUps) > 0) secondary.push(plural(n(w.followUps), 'follow-up', 'follow-ups'));
  if (!correctionsPrimary && n(w.corrections) > 0) secondary.push(plural(n(w.corrections), 'correction', 'corrections'));
  if (n(w.openTasks) > 0) secondary.push(plural(n(w.openTasks), 'open task', 'open tasks'));
  if (n(w.openAttendanceSessions) > 0) secondary.push(plural(n(w.openAttendanceSessions), 'open session', 'open sessions'));
  return { primary: primary.join(' · ') || secondary.shift() || '—', secondary: correctionsPrimary && secondary.length === 0 ? 'to resolve' : secondary.join(' · '), total };
}

export interface EmployeeTableProps {
  employees: EmployeeRow[];
  timeZone: string;
  onOpen: (employee: EmployeeRow) => void;
}

export function EmployeeTable({ employees, timeZone, onOpen }: EmployeeTableProps) {
  return (
    <TableContainer>
      <Table>
        <THead>
          <tr>
            <TH>Employee</TH>
            <TH>Role</TH>
            <TH>Account</TH>
            <TH>Sessions</TH>
            <TH>Open work</TH>
            <TH>Flags</TH>
            <TH className="w-12">
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {employees.map((emp) => {
            const work = summarizeOpenWork(emp.openWork, emp.role);
            return (
              <TR key={emp.id} className="border-t border-border-subtle cursor-pointer" onClick={() => onOpen(emp)}>
                <TD>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={emp.fullName} size="sm" tone="neutral" />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(emp);
                        }}
                        className="block text-left font-semibold text-text-primary truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        {emp.fullName}
                      </button>
                      <div className="text-xs text-text-muted truncate">{emp.email}</div>
                    </div>
                  </div>
                </TD>
                <TD className="text-text-secondary">{formatRoleName(emp.role)}</TD>
                <TD>
                  <Badge tone={emp.isActive ? 'success' : 'neutral'} hasDot={emp.isActive}>
                    {emp.isActive ? 'Active' : 'Deactivated'}
                  </Badge>
                </TD>
                <TD>
                  <div className="text-[13px] font-medium text-text-primary">
                    {emp.sessions.activeCount > 0 ? `${emp.sessions.activeCount} active` : 'No active session'}
                  </div>
                  <div className="text-xs text-text-muted">
                    {emp.sessions.activeCount > 0 && emp.sessions.activeSince
                      ? `${emp.twoFactorEnrolled && emp.role === 'owner' ? '2FA complete · ' : ''}since ${formatClock(emp.sessions.activeSince, timeZone)}`
                      : emp.sessions.lastSignOutAt
                        ? `Signed out ${formatDayTime(emp.sessions.lastSignOutAt, timeZone)}`
                        : 'Not signed in today'}
                  </div>
                </TD>
                <TD>
                  <div className="text-[13px] font-medium text-text-primary">{work.primary}</div>
                  {work.secondary && <div className="text-xs text-text-muted">{work.secondary}</div>}
                </TD>
                <TD>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {emp.missingCheckout && (
                      <Badge tone="warning" icon="flag">
                        Missing checkout
                      </Badge>
                    )}
                    {!emp.isActive && work.total > 0 && (
                      <Badge tone="danger" icon="flag">
                        Assignee inactive · {work.total}
                      </Badge>
                    )}
                    {emp.twoFactorEnrolled && emp.role === 'owner' && (
                      <Badge tone="neutral" className="rounded-md">
                        2FA enrolled
                      </Badge>
                    )}
                    {!emp.missingCheckout && emp.isActive && !(emp.twoFactorEnrolled && emp.role === 'owner') && (
                      <span className="text-text-muted">—</span>
                    )}
                  </div>
                </TD>
                <TD className="text-right">
                  <IconButton
                    icon="more"
                    label={`Open ${emp.fullName}`}
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(emp);
                    }}
                  />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableContainer>
  );
}
