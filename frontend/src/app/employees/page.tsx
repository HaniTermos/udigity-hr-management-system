'use client';

import React, { useDeferredValue, useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Select, SearchInput } from '@/components/ui/Input';
import { SkeletonTableRow, StateView } from '@/components/ui/State';
import { useToast } from '@/components/ui/Toast';
import { EmployeeDrawer } from '@/components/owner/EmployeeDrawer';
import { EmployeeTable } from '@/components/owner/EmployeeTable';
import { ROLE_OPTIONS, useCompanyTimezone } from '@/components/owner/format';
import { PermissionDenied } from '@/components/states/PermissionDenied';
import { ACTIONS } from '@/lib/actions';
import { ApiError } from '@/lib/api/client';
import { useCapability } from '@/lib/hooks/useCapability';
import { employeesListKey, listEmployees, type EmployeeListQuery, type EmployeeRow } from '@/lib/api/employees';
import type { Role } from '@/lib/api/types';

export default function EmployeesPage() {
  return <EmployeesView />;
}

function EmployeesView() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<'active' | 'deactivated' | ''>('');
  const [target, setTarget] = useState<EmployeeRow | 'new' | null>(null);
  const q = useDeferredValue(search.trim());
  const timeZone = useCompanyTimezone();
  const toast = useToast();

  const query: EmployeeListQuery = { q, role, status, pageSize: 100 };
  const key = employeesListKey(query);
  const { data, error, isLoading, mutate } = useSWR(key, () => listEmployees(query));

  const employees = data?.items ?? [];
  const filtered = Boolean(q || role || status);
  const allowed = useCapability(ACTIONS.employeeList);
  const denied = !allowed || (error instanceof ApiError && error.isPermissionDenied);

  // SHR-011: no header, Add employee or filters for someone who cannot open the directory.
  if (denied) {
    return (
      <AppShell>
        <PermissionDenied area="the employee directory" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Employees</h1>
            <p className="text-[13px] text-text-secondary mt-1">
              {data ? `${data.total} ${filtered ? 'matching ' : ''}${data.total === 1 ? 'employee' : 'employees'} · ` : ''}
              {data && !filtered ? `${employees.filter((e) => e.isActive).length} active · ` : ''}Owner only
            </p>
          </div>
          <Button onClick={() => setTarget('new')} leadingIcon={<Icon name="plus" size={16} />}>
            Add employee
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <SearchInput
            label="Search name or email"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            wrapperClassName="sm:max-w-sm"
          />
          <Select
            aria-label="Filter by role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role | '')}
            placeholder="All roles"
            options={ROLE_OPTIONS}
            wrapperClassName="sm:w-44"
          />
          <Select
            aria-label="Filter by account status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'deactivated' | '')}
            placeholder="All statuses"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'deactivated', label: 'Deactivated' },
            ]}
            wrapperClassName="sm:w-44"
          />
          <span className="sm:ml-auto text-[13px] text-text-muted" aria-live="polite">
            {data ? `${data.total} ${data.total === 1 ? 'result' : 'results'}` : ''}
          </span>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border-default bg-surface-default" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonTableRow key={i} />
            ))}
          </div>
        ) : error ? (
          <StateView
            type="error"
            action={
              <Button variant="secondary" onClick={() => mutate()}>
                Try again
              </Button>
            }
          />
        ) : employees.length === 0 ? (
          <StateView
            type={filtered ? 'no-results' : 'empty'}
            title={filtered ? 'No employees match' : 'No employees yet'}
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setRole('');
                    setStatus('');
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EmployeeTable employees={employees} timeZone={timeZone} onOpen={setTarget} />
        )}

        <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
          <p className="text-[13px] text-text-secondary leading-relaxed max-w-xl">
            Account state (Active / Deactivated) is separate from sign-in sessions. Deactivating revokes every session immediately; open work stays attached until reassigned.
          </p>
        </div>
      </div>

      <EmployeeDrawer
        target={target}
        timeZone={timeZone}
        onClose={() => setTarget(null)}
        onSaved={(message) => {
          void mutate();
          toast.show({ tone: 'success', title: message });
        }}
      />
    </AppShell>
  );
}
