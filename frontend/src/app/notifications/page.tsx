'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Icon } from '@/components/ui/Icon';
import { notificationIcon, relativeTime, safeLink } from '@/components/notifications/format';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  notificationsPaths,
  type NotificationItem,
} from '@/lib/api/notifications';

const PAGE_SIZE = 20;
/** New notices appear without a reload (the header badge polls on its own). */
const REFRESH_MS = 30_000;

export default function NotificationsPage() {
  const router = useRouter();
  const time = useCompanyTime();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Same key as the header bell, so marking read here updates the badge at once.
  const { data: countData, mutate: mutateCount } = useSWR(notificationsPaths.unreadCount, getUnreadCount, {
    refreshInterval: REFRESH_MS,
  });

  const unreadOnly = activeTab === 'unread';
  const { data, error, isLoading, mutate } = useSWR(
    `${notificationsPaths.list}?unreadOnly=${unreadOnly}&page=${page}&pageSize=${PAGE_SIZE}`,
    () => listNotifications({ unreadOnly, page, pageSize: PAGE_SIZE }),
    { keepPreviousData: true, refreshInterval: REFRESH_MS }
  );

  const unreadCount = countData?.unreadCount ?? 0;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Reading items on the last "Unread" page can leave it empty: step back to a page that has rows.
  if (data && items.length === 0 && page > totalPages) setPage(totalPages);

  const refresh = () => Promise.all([mutate(), mutateCount()]);

  const openItem = async (item: NotificationItem) => {
    setActionError(null);
    const target = safeLink(item.link);
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        await refresh();
      } catch {
        if (!target) setActionError('Could not mark the notification as read. Try again.');
      }
    }
    if (target) router.push(target);
  };

  const markRead = async (item: NotificationItem) => {
    setActionError(null);
    try {
      await markNotificationRead(item.id);
      await refresh();
    } catch {
      setActionError('Could not mark the notification as read. Try again.');
    }
  };

  const markAllRead = async () => {
    setActionError(null);
    setBusy(true);
    try {
      await markAllNotificationsRead();
      await refresh();
    } catch {
      setActionError('Could not mark all notifications as read. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-default">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-surface-sunken flex items-center justify-center text-brand-accent shrink-0 border border-border-default">
              <Icon name="bell" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">Notifications</h1>
                {unreadCount > 0 && (
                  <Badge tone="brand" size="md">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">Assignments, reminders, review requests and alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {unreadCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                isLoading={busy}
                leadingIcon={<Icon name="check-circle" size={16} />}
                onClick={markAllRead}
              >
                Mark all as read
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between gap-4">
          <Tabs
            style="segmented"
            activeId={activeTab}
            onChange={(id) => {
              setActiveTab(id as 'all' | 'unread');
              setPage(1);
            }}
            items={[
              { id: 'all', label: 'All', count: activeTab === 'all' ? data?.total : undefined },
              { id: 'unread', label: 'Unread', count: unreadCount },
            ]}
          />
        </div>

        {actionError && (
          <p role="alert" className="text-sm text-status-danger-fg">
            {actionError}
          </p>
        )}

        {/* List */}
        {isLoading && items.length === 0 ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
            <Icon name="spinner" size={28} className="animate-spin text-brand-accent" />
            <span className="text-sm">Loading notifications...</span>
          </div>
        ) : error && items.length === 0 ? (
          <Card className="p-6 text-center border-status-danger-border bg-status-danger-bg text-status-danger-fg space-y-3">
            <p className="text-sm font-medium">Notifications could not be loaded.</p>
            <Button variant="secondary" size="sm" onClick={() => void mutate()}>
              Try again
            </Button>
          </Card>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center text-text-muted space-y-2">
            <div className="size-12 rounded-full bg-surface-sunken flex items-center justify-center mx-auto text-text-muted mb-3 border border-border-subtle">
              <Icon name="bell" size={24} />
            </div>
            <h3 className="text-base font-semibold text-text-primary">
              {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              {unreadOnly
                ? "You're all caught up. New notifications will show up here."
                : 'Assignments, reminders and review requests will show up here.'}
            </p>
          </Card>
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => {
              const isUnread = !item.readAt;
              const target = safeLink(item.link);
              return (
                <li key={item.id}>
                  <Card
                    className={`p-4 transition-colors duration-200 flex items-start gap-4 ${
                      isUnread
                        ? 'bg-surface-raised border-border-strong shadow-elevation-1'
                        : 'bg-surface-default border-border-default hover:bg-surface-hover'
                    }`}
                  >
                    <div
                      className={`size-10 rounded-lg flex items-center justify-center shrink-0 border ${
                        isUnread
                          ? 'bg-status-brand-bg text-brand-accent border-brand-accent/20'
                          : 'bg-surface-sunken text-text-secondary border-border-subtle'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon name={notificationIcon(item.template)} size={18} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <button
                        type="button"
                        onClick={() => void openItem(item)}
                        className="block w-full text-left cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-brand-accent"
                        aria-label={`${item.title}${isUnread ? ' (unread)' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <h2
                              className={`text-sm tracking-tight text-text-primary truncate ${isUnread ? 'font-semibold' : 'font-medium'}`}
                            >
                              {item.title}
                            </h2>
                            {isUnread && <span className="size-2 rounded-full bg-brand-accent shrink-0" aria-hidden="true" />}
                          </div>
                          <time
                            dateTime={item.createdAt}
                            title={time.format(item.createdAt)}
                            className="text-[11px] text-text-muted shrink-0 tabular-nums"
                          >
                            {relativeTime(item.createdAt, new Date(), time.timezone)}
                          </time>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed mt-1">{item.message}</p>
                      </button>

                      <div className="flex items-center gap-3 pt-1">
                        {target && (
                          <button
                            type="button"
                            onClick={() => void openItem(item)}
                            className="text-xs font-medium text-brand-accent hover:underline cursor-pointer"
                          >
                            Open
                          </button>
                        )}
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => void markRead(item)}
                            className="text-xs font-medium text-text-secondary hover:text-text-primary hover:underline cursor-pointer"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-between gap-3" aria-label="Notification pages">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              leadingIcon={<Icon name="chevron-left" size={16} />}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Newer
            </Button>
            <span className="text-xs text-text-muted tabular-nums">
              Page {Math.min(page, totalPages)} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              trailingIcon={<Icon name="chevron-right" size={16} />}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Older
            </Button>
          </nav>
        )}
      </div>
    </AppShell>
  );
}
