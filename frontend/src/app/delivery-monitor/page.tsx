'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Icon } from '@/components/ui/Icon';
import {
  listDeliveryMonitor,
  retryReminder,
  type DeliveryMonitorItem } from '@/lib/api/deliveryMonitor';

/** Plain names for email templates and reminder sources (the API sends internal keys). */
const SOURCE_LABEL: Record<string, string> = {
  'security.credential_setup': 'Invitation email',
  'security.password_reset': 'Password reset email',
  'security.password_reset_completed': 'Password changed email',
  'security.recovery_code_used': 'Recovery code used email',
  'business.assignment': 'Calling assignment',
  'business.attendance_alert': 'Attendance alert',
  'business.attendance_review': 'Attendance review',
  'business.correction_request': 'Correction request',
  'business.deal_closure': 'Deal closure request',
  'business.deal_closure_rejected': 'Deal closure rejected',
  'business.delivery_failure': 'Failure alert',
  'business.developer_handoff': 'Developer handoff',
  'business.duplicate_review': 'Duplicate review',
  'business.duplicate_review_requested': 'Duplicate review request',
  'business.follow_up_digest': 'Daily digest',
  'business.owner_digest': 'Daily digest',
  'business.follow_up_overdue': 'Overdue follow-up',
  'business.follow_up_reminder': 'Follow-up reminder',
  'business.meeting_reminder': 'Meeting reminder',
  'business.provisioning_failed': 'Project setup failed',
  'business.reservation_overridden': 'Contact taken over by Owner',
  'attendance.missing_checkin_detected': 'Missing check-in',
  'attendance.missing_checkout_detected': 'Missing check-out',
  'attendance.missing_checkout_reminder': 'Missing check-out reminder',
  'attendance.checkout_pending_review': 'Check-out held for review',
  'attendance.checkout_provisional': 'Provisional check-out',
  'ops.alert': 'Failure alert',
  'follow_up reminder': 'Follow-up reminder',
  'meeting reminder': 'Meeting reminder',
  'attendance_correction reminder': 'Attendance correction reminder',
  'business reminder': 'Business reminder',
  'employee reminder': 'Employee reminder',
  'security_token reminder': 'Security reminder',
};

const KIND_LABEL: Record<string, string> = { reminder: 'Reminder', notification: 'Email', provisioning: 'Project setup' };

/** Unknown keys: last part after the dots, underscores as spaces, first letter capitalised. */
function sourceLabel(key: string): string {
  const known = SOURCE_LABEL[key];
  if (known) return known;
  const text = (key.split('.').pop() ?? key).replace(/[_.]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Message';
}

export default function DeliveryMonitorPage() {
  const [kindFilter, setKindFilter] = useState<'all' | 'reminder' | 'notification'>('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'all' | 'failed' | 'pending'>('all');
  const [page, setPage] = useState(1);
  const time = useCompanyTime();

  const queryKind = kindFilter === 'all' ? undefined : kindFilter;
  const queryState = stateFilter === 'all' ? undefined : stateFilter;
  const listKey = `/api/delivery-monitor?kind=${queryKind ?? 'all'}&state=${queryState ?? 'all'}&page=${page}`;

  const { data, error, isLoading, mutate } = useSWR(
    listKey,
    () => listDeliveryMonitor({ kind: queryKind, state: queryState, page, pageSize: 50 }),
    { refreshInterval: 10000, keepPreviousData: true }
  );

  const items = data?.items ?? [];

  const handleRetry = async (id: string) => {
    try {
      setRetryingId(id);
      setRetryMessage(null);
      setRetryError(null);
      const res = await retryReminder(id);
      setRetryMessage(res.message);
      await mutate();
    } catch (err) {
      setRetryError(err instanceof Error && err.message ? err.message : 'Could not queue this message again. Try again.');
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'sent':
        return <Badge tone="success">Sent</Badge>;
      case 'pending':
      case 'retry_pending':
        return <Badge tone="warning">Pending</Badge>;
      case 'failed':
        return <Badge tone="danger">Failed</Badge>;
      case 'suppressed':
        return <Badge tone="neutral">Suppressed</Badge>;
      case 'skipped':
        return <Badge tone="neutral">Skipped</Badge>;
      default:
        return <Badge tone="neutral">{sourceLabel(state)}</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-default">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-surface-sunken flex items-center justify-center text-brand-accent shrink-0 border border-border-default">
              <Icon name="list" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                Delivery & Exception Monitor
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Track sent emails, reminders and messages waiting to be resent
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Icon name="refresh" size={16} />}
              onClick={() => mutate()}
            >
              Refresh Status
            </Button>
          </div>
        </div>

        {/* Retry Alert */}
        {retryMessage && (
          <div className="p-3 bg-status-success-bg border border-status-success-border rounded-lg text-status-success-fg text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="check-circle" size={16} />
              <span>{retryMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setRetryMessage(null)}
              className="text-xs hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {retryError && (
          <div role="alert" className="p-3 bg-status-danger-bg border border-status-danger-border rounded-lg text-status-danger-fg text-xs flex items-center justify-between">
            <span>{retryError}</span>
            <button type="button" onClick={() => setRetryError(null)} className="text-xs hover:underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between gap-4">
          <Tabs
            style="segmented"
            activeId={kindFilter}
            onChange={(id) => {
              setKindFilter(id as 'all' | 'reminder' | 'notification');
              setPage(1);
            }}
            items={[
              { id: 'all', label: 'All Items', count: data?.total },
              { id: 'notification', label: 'Notifications' },
              { id: 'reminder', label: 'Reminders' },
            ]}
          />
          <Tabs
            style="segmented"
            activeId={stateFilter}
            onChange={(id) => {
              setStateFilter(id as 'all' | 'failed' | 'pending');
              setPage(1);
            }}
            items={[
              { id: 'all', label: 'Any state' },
              { id: 'failed', label: 'Failed' },
              { id: 'pending', label: 'Pending' },
            ]}
          />
        </div>

        {/* Monitor Table */}
        <Card className="overflow-hidden border-border-default bg-surface-default shadow-xs">
          {isLoading && items.length === 0 ? (
            <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
              <Icon name="spinner" size={28} className="animate-spin text-brand-accent" />
              <span className="text-sm">Loading delivery records...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-status-danger-fg bg-status-danger-bg text-sm">
              Failed to load delivery monitor data
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-text-muted space-y-2">
              <Icon name="check-circle" size={28} className="mx-auto text-status-success-fg" />
              <h3 className="text-sm font-semibold text-text-primary">Nothing needs attention</h3>
              <p className="text-xs text-text-secondary">
                No delivery failures or pending items in this view.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-sunken border-b border-border-default text-text-secondary uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Kind / Type</th>
                    <th className="px-4 py-3 font-semibold">Recipient</th>
                    <th className="px-4 py-3 font-semibold">Channel</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Attempts</th>
                    <th className="px-4 py-3 font-semibold">Last Error</th>
                    <th className="px-4 py-3 font-semibold">Created / Sent</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {items.map((item: DeliveryMonitorItem) => (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-hover transition-colors text-text-primary"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Badge tone={item.kind === 'reminder' ? 'brand' : 'neutral'}>
                            {KIND_LABEL[item.kind] ?? sourceLabel(item.kind)}
                          </Badge>
                          <span className="font-medium text-xs">
                            {sourceLabel(item.templateOrSource)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-text-primary">{item.recipientName}</div>
                        <div className="text-[11px] text-text-muted">{item.recipientEmail}</div>
                      </td>
                      <td className="px-4 py-3.5 text-text-secondary text-[11px]">
                        {sourceLabel(item.channel)}
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(item.state)}</td>
                      <td className="px-4 py-3.5 tabular-nums font-semibold">
                        {item.attemptCount}
                      </td>
                      <td className="px-4 py-3.5 max-w-[200px] truncate text-status-danger-fg text-[11px]" title={item.lastError ?? ''}>
                        {item.lastError || <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-text-muted tabular-nums text-[11px]">
                        {time.format(item.sentAt || item.createdAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {(item.state === 'failed' || item.state === 'pending') && (
                          <Button
                            variant="secondary"
                            size="sm"
                            leadingIcon={<Icon name="refresh" size={14} />}
                            disabled={retryingId === item.id}
                            onClick={() => handleRetry(item.id)}
                          >
                            {retryingId === item.id ? 'Queueing...' : 'Send again'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>
              Showing {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Policy note */}
      </div>
    </AppShell>
  );
}
