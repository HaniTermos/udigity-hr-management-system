'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Drawer } from '@/components/ui/Drawer';
import { Icon } from '@/components/ui/Icon';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { StateView } from '@/components/ui/State';
import { ApiError } from '@/lib/api/client';
import {
  createEmployee,
  employeesPaths,
  getOpenItems,
  setEmployeeActive,
  updateEmployee,
  type EmployeeRow,
  type OpenItemsDto,
} from '@/lib/api/employees';
import { requestPasswordReset } from '@/lib/api/identity';
import type { Role } from '@/lib/api/types';
import { AttendanceEmployeeSchedule } from './AttendanceEmployeeSchedule';
import { formatClock, formatRoleName, ROLE_OPTIONS } from './format';

export interface EmployeeDrawerProps {
  /** `null` = closed. `'new'` = create. */
  target: EmployeeRow | 'new' | null;
  timeZone: string;
  onClose: () => void;
  /** Called after any successful write so the list can revalidate. */
  onSaved: (message: string) => void;
}

export function EmployeeDrawer({ target, timeZone, onClose, onSaved }: EmployeeDrawerProps) {
  const isNew = target === 'new';
  const employee = target && target !== 'new' ? target : null;
  return (
    <Drawer
      isOpen={target !== null}
      onClose={onClose}
      title={isNew ? 'Add employee' : 'Edit employee'}
      subtitle={isNew ? 'Create an account; a set-password link is queued by email' : employee ? `${employee.fullName} · ${formatRoleName(employee.role)}` : undefined}
    >
      {target !== null && (
        <EmployeeForm
          key={employee ? `${employee.id}:${employee.version}` : 'new'}
          employee={employee}
          timeZone={timeZone}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Drawer>
  );
}

type Fields = { fullName: string; jobTitle: string; email: string; phone: string; department: string; role: Role | '' };

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'LAST_ACTIVE_OWNER') return 'This is the last active Owner. Make another employee an active Owner first.';
    if (err.code === 'CANNOT_DEACTIVATE_SELF') return 'You cannot change your own role or deactivate your own account.';
  }
  return err instanceof ApiError ? err.message : 'Something went wrong. Your data is safe — try again.';
}

function EmployeeForm({
  employee,
  timeZone,
  onClose,
  onSaved,
}: {
  employee: EmployeeRow | null;
  timeZone: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [f, setF] = useState<Fields>({
    fullName: employee?.fullName ?? '',
    jobTitle: employee?.jobTitle ?? '',
    email: employee?.email ?? '',
    phone: employee?.phone ?? '',
    department: employee?.department ?? '',
    // No default role on create: a silent default could hand a new account the wrong access.
    role: employee?.role ?? '',
  });
  const [roleMissing, setRoleMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  async function handleSendReset() {
    if (!employee) return;
    setResetSending(true);
    setError(null);
    try {
      await requestPasswordReset(employee.email);
      onSaved(`Password reset link sent to ${employee.email}`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to send reset link'));
    } finally {
      setResetSending(false);
    }
  }
  // Fixed v1 scope (approved 2026-10-29): the four roles only; custom roles are not offered.
  const roleOptions = ROLE_OPTIONS;
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setF((cur) => ({ ...cur, [k]: v }));

  const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
  const fe = (k: string) => fieldErrors[k]?.[0];
  const conflict = error instanceof ApiError && error.isVersionConflict;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!employee && !f.role) {
      setRoleMissing(true);
      return;
    }
    setBusy(true);
    const profile = {
      fullName: f.fullName.trim(),
      email: f.email.trim(),
      jobTitle: f.jobTitle.trim() || null,
      phone: f.phone.trim() || null,
      department: f.department.trim() || null,
    };
    try {
      if (employee) {
        await updateEmployee(employee.id, { ...profile, version: employee.version });
        onSaved(`${profile.fullName} saved`);
      } else {
        await createEmployee({ ...profile, role: f.role as Role });
        onSaved(`${profile.fullName} added`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Save failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <form id="employee-form" onSubmit={save} className="space-y-6" noValidate>
      {conflict && (
        <StateView
          type="save-conflict"
          size="inline"
          action={
            <Button type="button" variant="link" onClick={() => {
                onSaved('Reloaded latest employee data');
                onClose();
              }}>
              Review the latest version
            </Button>
          }
        />
      )}
      {error && !conflict && Object.keys(fieldErrors).length === 0 && <Alert tone="danger" title="Could not save" body={errorText(error)} />}

      <section className="space-y-4" aria-labelledby="emp-profile">
        <h3 id="emp-profile" className="ds-overline text-text-secondary">
          Profile details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Full name" required value={f.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="e.g. Maya Khoury" error={fe('fullName')} />
          <Input label="Job title" value={f.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="e.g. Call Center agent" error={fe('jobTitle')} />
        </div>
        <Input
          label="Email"
          required
          type="email"
          value={f.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="maya.khoury@udigity.example"
          error={fe('email') ?? (error instanceof ApiError && error.code === 'CONFLICT_DUPLICATE' ? 'This email is already in use.' : undefined)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Phone" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="70 000 121" error={fe('phone')} />
          <Input label="Department" value={f.department} onChange={(e) => set('department', e.target.value)} placeholder="Calling" error={fe('department')} />
        </div>
        {!employee && (
          <Select
            label="Role"
            required
            value={f.role}
            onChange={(e) => {
              set('role', e.target.value as Role);
              setRoleMissing(false);
            }}
            placeholder="Select one role"
            options={roleOptions}
            error={fe('role') ?? (roleMissing ? 'Choose a role for this employee.' : undefined)}
            helperText="Changing a role later revokes the employee's sessions."
          />
        )}
      </section>

      {employee && <AttendanceEmployeeSchedule employeeId={employee.id} />}

      {employee && (
        <section className="space-y-4 pt-4 border-t border-border-subtle" aria-labelledby="emp-role">
          <div>
            <h3 id="emp-role" className="ds-overline text-text-secondary">
              Role and status
            </h3>
            <p className="text-xs text-text-muted mt-1">Not edited in this form. Change role revokes sessions; Deactivate lists open work first.</p>
          </div>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Role</dt>
              <dd className="font-medium text-text-primary">{formatRoleName(employee.role)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Account · sessions</dt>
              <dd className="font-medium text-text-primary text-right">
                <Badge tone={employee.isActive ? 'success' : 'neutral'} className="mr-2">
                  {employee.isActive ? 'Active' : 'Deactivated'}
                </Badge>
                {employee.sessions.activeCount > 0 && employee.sessions.activeSince
                  ? `${employee.sessions.activeCount} session since ${formatClock(employee.sessions.activeSince, timeZone)}`
                  : 'No active session'}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => setRoleOpen(true)}>
              Change role…
            </Button>
            {employee.isActive ? (
              <Button type="button" variant="destructive" onClick={() => setDeactivateOpen(true)}>
                Deactivate…
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setDeactivateOpen(true)}>
                Reactivate…
              </Button>
            )}
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Send reset link queues an email; you never see the password. Delivery failures appear in Delivery monitor.
          </p>
        </section>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
        {employee && (
          <Button
            type="button"
            variant="secondary"
            isLoading={resetSending}
            disabled={resetSending}
            onClick={handleSendReset}
            leadingIcon={<Icon name="mail" size={16} />}
          >
            Send reset link
          </Button>
        )}
        <span className="flex-1" />
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={busy} disabled={busy}>
          {employee ? 'Save changes' : 'Add employee'}
        </Button>
      </div>

    </form>
      {employee && (
        <>
          <ChangeRoleDialog
            employee={employee}
            isOpen={roleOpen}
            onClose={() => setRoleOpen(false)}
            onSaved={(m) => {
              setRoleOpen(false);
              onSaved(m);
              onClose();
            }}
          />
          <StatusDialog
            employee={employee}
            isOpen={deactivateOpen}
            onClose={() => setDeactivateOpen(false)}
            onSaved={(m) => {
              setDeactivateOpen(false);
              onSaved(m);
              onClose();
            }}
          />
        </>
      )}
    </>
  );
}

function ChangeRoleDialog({
  employee,
  isOpen,
  onClose,
  onSaved,
}: {
  employee: EmployeeRow;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [role, setRole] = useState<Role>(employee.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Fixed v1 scope: the four roles only.
  const roleOptions = ROLE_OPTIONS;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await updateEmployee(employee.id, { role, version: employee.version });
      onSaved(`${employee.fullName} is now ${formatRoleName(role)}; sessions revoked`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Change role"
      description={`${employee.fullName} is currently ${formatRoleName(employee.role)}. Every active session is revoked and the employee signs in again.`}
      maxWidth="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} isLoading={busy} disabled={busy || role === employee.role}>
            Change role
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Select label="New role" value={role} onChange={(e) => setRole(e.target.value as Role)} options={roleOptions} />
        {error !== null && <Alert tone="danger" title="Could not change role" body={errorText(error)} />}
      </div>
    </Dialog>
  );
}

const WORK_LABELS: { key: Exclude<keyof OpenItemsDto, 'unavailable'>; label: string }[] = [
  { key: 'assignments', label: 'Calling assignments' },
  { key: 'followUps', label: 'Open follow-ups' },
  { key: 'corrections', label: 'Corrections to resolve' },
  { key: 'deals', label: 'Open deals' },
  { key: 'projects', label: 'Projects' },
  { key: 'openTasks', label: 'Open tasks' },
  { key: 'openAttendanceSessions', label: 'Open attendance sessions' },
];

function StatusDialog({
  employee,
  isOpen,
  onClose,
  onSaved,
}: {
  employee: EmployeeRow;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const deactivating = employee.isActive;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { data: counts, error: loadError } = useSWR<OpenItemsDto>(
    isOpen && deactivating ? employeesPaths.openItems(employee.id) : null,
    () => getOpenItems(employee.id),
  );
  // null = module not shipped yet: shown as "Not available yet", never as 0 (BE1-C1).
  const rows = counts ? WORK_LABELS.filter((w) => counts[w.key] === null || (counts[w.key] ?? 0) > 0) : [];
  const hasUnavailable = counts ? WORK_LABELS.some((w) => counts[w.key] === null) : false;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await setEmployeeActive(employee.id, {
        isActive: !deactivating,
        version: employee.version,
        reason: reason.trim() || undefined,
      });
      onSaved(deactivating ? `${employee.fullName} deactivated; sessions revoked` : `${employee.fullName} reactivated`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={deactivating ? 'Deactivate account' : 'Reactivate account'}
      description={
        deactivating
          ? `${employee.fullName} is signed out everywhere at once. Open work stays attached and is flagged "assignee inactive" until you reassign it.`
          : `${employee.fullName} can sign in again with their existing credentials.`
      }
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant={deactivating ? 'destructive' : 'primary'} onClick={confirm} isLoading={busy} disabled={busy}>
            {deactivating ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {deactivating && (
          <div>
            <h3 className="ds-overline text-text-secondary mb-2">Open work that stays with this employee</h3>
            {loadError ? (
              <StateView type="error" size="inline" body="Open work could not be loaded. You can still continue." />
            ) : !counts ? (
              <StateView type="loading" size="inline" title="Loading open work…" />
            ) : rows.length === 0 ? (
              <p className="text-[13px] text-text-secondary">No open work.</p>
            ) : (
              <>
              <ul className="divide-y divide-border-subtle rounded-lg border border-border-default">
                {rows.map((r) => (
                  <li key={r.key} className="flex justify-between px-3 py-2 text-[13px]">
                    <span className="text-text-secondary">{r.label}</span>
                    {counts[r.key] === null ? (
                      <span className="text-text-muted">Not available yet</span>
                    ) : (
                      <span className="font-semibold tabular-nums text-text-primary">{counts[r.key]}</span>
                    )}
                  </li>
                ))}
              </ul>
              {hasUnavailable && (
                <p className="mt-2 text-xs text-text-muted">
                  Some modules do not report open work yet, so those counts are not shown. They are not zero.
                </p>
              )}
              </>
            )}
          </div>
        )}
        <Textarea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />
        {error !== null && <Alert tone="danger" title="Could not update the account" body={errorText(error)} />}
      </div>
    </Dialog>
  );
}
