'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { StepUpDialog } from '@/components/owner/StepUpDialog';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Input';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { Skeleton, StateView } from '@/components/ui/State';
import { PermissionDenied } from '@/components/states/PermissionDenied';
import { ACTIONS } from '@/lib/actions';
import { ApiError } from '@/lib/api/client';
import { useCapability } from '@/lib/hooks/useCapability';
import { exportReport, reportsPaths, type ReportItem } from '@/lib/api/reports';
import { useApi } from '@/lib/hooks/useApi';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';

type ListResponse = { items: ReportItem[]; total: number };

function stepUpMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'INVALID_2FA_TOKEN') return 'That code is not valid. Check your authenticator app and try again.';
    if (err.code === 'TOO_MANY_ATTEMPTS') return 'Too many attempts. Wait a few minutes and try again.';
    if (err.code === '2FA_NOT_CONFIGURED') return 'Two-factor authentication is not set up for your account.';
    return err.message;
  }
  return 'Something went wrong. Try again.';
}

export default function ReportsPage() {
  const time = useCompanyTime();
  const { data, error, route, isLoading, retry } = useApi<ListResponse>(reportsPaths.reports, { refreshInterval: 0 });
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'danger' | 'info'; text: string } | null>(null);
  const [stepUp, setStepUp] = useState<{ id: string; error: string | null } | null>(null);

  const rangeInvalid = Boolean(from && to && from > to);
  const allowed = useCapability(ACTIONS.reportRead);
  const denied = !allowed || (error instanceof ApiError && error.isPermissionDenied);

  async function run(reportId: string, totpCode?: string) {
    setBusyId(reportId);
    setNotice(null);
    try {
      const res = await exportReport({ report: reportId, format, from: from || undefined, to: to || undefined, totpCode });
      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename ?? `${reportId}-${time.dayKey(new Date())}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setStepUp(null);
      if (res.truncated) {
        setNotice({ tone: 'info', text: `The export was limited to the first ${res.rowCount ?? 'available'} rows. Narrow the date range to get the rest.` });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STEP_UP_REQUIRED') {
        setStepUp({ id: reportId, error: null });
      } else if (totpCode !== undefined) {
        setStepUp({ id: reportId, error: stepUpMessage(err) });
        throw err;
      } else {
        setNotice({ tone: 'danger', text: err instanceof ApiError ? err.message : 'Export failed. Try again.' });
      }
    } finally {
      setBusyId(null);
    }
  }

  // SHR-011: no format or date controls for someone who cannot open reports.
  if (denied) {
    return (
      <AppShell>
        <PermissionDenied area="Reports & Exports" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <h1 className="text-2xl font-semibold leading-8 tracking-tight text-text-primary">Reports & Data Exports</h1>
            <p className="text-xs text-text-muted mt-1">Exports are generated on request and need a fresh verification code.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Format"
              value={format}
              onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
              options={[
                { value: 'csv', label: 'CSV' },
                { value: 'json', label: 'JSON' },
              ]}
            />
            <label className="flex flex-col gap-1 text-sm font-medium text-text-primary">
              From
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 px-3 rounded-md border border-border-input bg-surface-default text-sm text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-text-primary">
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 px-3 rounded-md border border-border-input bg-surface-default text-sm text-text-primary"
              />
            </label>
          </div>
        </div>

        {rangeInvalid && <Alert tone="warning" title="Check the date range" body="The start date must be on or before the end date." />}
        {notice && (
          <Alert
            tone={notice.tone}
            title={notice.tone === 'danger' ? 'Export failed' : 'Export complete'}
            body={notice.text}
            role={notice.tone === 'danger' ? 'alert' : 'status'}
          />
        )}

        {error ? (
          <ApiErrorView error={error} route={route} onRetry={() => void retry()} area="Reports & Exports" what="the report list" />
        ) : isLoading || !data ? (
          <div role="status" aria-label="Loading reports" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        ) : data.items.length === 0 ? (
          <StateView type="empty" size="page" title="No reports available" body="No reports are enabled for your account." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.items.map((rep) => (
              <Card key={rep.id} className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-sm text-text-primary">{rep.title}</h2>
                    <Badge tone="neutral">{rep.badge}</Badge>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{rep.description}</p>
                </div>
                <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-text-muted">{rep.format}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Icon name={busyId === rep.id ? 'spinner' : 'download'} size={14} className={busyId === rep.id ? 'animate-spin' : ''} />}
                    disabled={busyId !== null || rangeInvalid}
                    onClick={() => void run(rep.id)}
                  >
                    {busyId === rep.id ? 'Exporting…' : 'Download'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-text-muted flex flex-wrap items-center gap-2">
          <PolicyPendingChip dec="OQ-18" label="export scope open" />
          <span>Which fields each export may contain is not decided yet. Exports are recorded in the audit log.</span>
        </p>
      </div>

      <StepUpDialog
        isOpen={stepUp !== null}
        onClose={() => setStepUp(null)}
        title="Confirm the export"
        description="Exports contain company data. Enter the 6-digit code from your authenticator app."
        submitLabel="Verify and download"
        error={stepUp?.error}
        onSubmit={(code) => run(stepUp!.id, code)}
      />
    </AppShell>
  );
}
