'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Icon } from '@/components/ui/Icon';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/lib/api/notifications';

function formatTemplateTitle(template: string): string {
  return template
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getTemplateIcon(template: string, family: string) {
  if (family === 'security') return 'shield';
  if (template.includes('deal') || template.includes('opportunity')) return 'briefcase';
  if (template.includes('project') || template.includes('task')) return 'check-circle';
  if (template.includes('call')) return 'phone';
  return 'bell';
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const { data: countData, mutate: mutateCount } = useSWR(
    '/api/notifications/unread-count',
    getUnreadCount,
    { refreshInterval: 15000 }
  );

  const listKey = `/api/notifications?unreadOnly=${activeTab === 'unread'}`;
  const { data, error, isLoading, mutate } = useSWR(
    listKey,
    () => listNotifications({ unreadOnly: activeTab === 'unread', pageSize: 50 }),
    { keepPreviousData: true }
  );

  const unreadCount = countData?.unreadCount ?? 0;
  const items = data?.items ?? [];

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      await Promise.all([mutate(), mutateCount()]);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await Promise.all([mutate(), mutateCount()]);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
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
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                  Notifications
                </h1>
                {unreadCount > 0 && (
                  <Badge tone="brand" size="md">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                In-app alerts, assignments, mentions, and delivery updates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {unreadCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Icon name="check-circle" size={16} />}
                onClick={handleMarkAllRead}
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
            onChange={(id) => setActiveTab(id as 'all' | 'unread')}
            items={[
              { id: 'all', label: 'All notifications', count: data?.total },
              { id: 'unread', label: 'Unread only', count: unreadCount },
            ]}
          />
        </div>

        {/* Notifications List */}
        {isLoading && items.length === 0 ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
            <Icon name="spinner" size={28} className="animate-spin text-brand-accent" />
            <span className="text-sm">Loading notifications...</span>
          </div>
        ) : error ? (
          <Card className="p-6 text-center border-status-danger-border bg-status-danger-bg text-status-danger-fg">
            <p className="text-sm font-medium">Failed to load notifications</p>
          </Card>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center text-text-muted space-y-2">
            <div className="size-12 rounded-full bg-surface-sunken flex items-center justify-center mx-auto text-text-muted mb-3 border border-border-subtle">
              <Icon name="bell" size={24} />
            </div>
            <h3 className="text-base font-semibold text-text-primary">
              {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              {activeTab === 'unread'
                ? "You're all caught up! New alerts and activity will show up here."
                : 'Activity, task assignments, and reminder updates will appear in this feed.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {items.map((item: NotificationItem) => {
              const isUnread = !item.readAt;
              const iconName = getTemplateIcon(item.template, item.family);

              return (
                <Card
                  key={item.id}
                  className={`p-4 transition-all duration-200 flex items-start gap-4 ${
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
                  >
                    <Icon name={iconName} size={18} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-text-primary tracking-tight">
                          {formatTemplateTitle(item.template)}
                        </h4>
                        {isUnread && (
                          <span className="size-2 rounded-full bg-brand-accent shrink-0 animate-pulse" />
                        )}
                      </div>
                      <span className="text-[11px] text-text-muted shrink-0 tabular-nums">
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed">
                      {item.family === 'security'
                        ? 'A security event was logged for your account credentials.'
                        : `Notification regarding ${item.template.replace(/_/g, ' ')}.`}
                    </p>

                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-[11px] text-text-muted capitalize">
                        Channel: {item.channel === 'in_app' ? 'In-app' : 'Email'}
                      </span>
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(item.id)}
                          className="text-xs font-medium text-brand-accent hover:underline cursor-pointer"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
