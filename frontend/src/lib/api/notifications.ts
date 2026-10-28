/**
 * notifications API — backend MOD-notifications (BE5).
 * Screens: SCR-SHR-007 in-app list and the header badge.
 */
import { api } from './client';
import type { Page } from './types';

export const notificationsPaths = {
  list: '/api/notifications',
  unreadCount: '/api/notifications/unread-count',
  read: (id: string) => `/api/notifications/${id}/read`,
  readAll: '/api/notifications/read-all',
} as const;

export interface NotificationItem {
  id: string;
  template: string;
  family: 'security' | 'business';
  channel: 'email' | 'in_app';
  state: string;
  readAt: string | null;
  createdAt: string;
}

export async function listNotifications(options: {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
} = {}): Promise<Page<NotificationItem>> {
  return api.get<Page<NotificationItem>>(notificationsPaths.list, {
    query: {
      unreadOnly: options.unreadOnly ? 'true' : undefined,
      page: options.page,
      pageSize: options.pageSize,
    },
  });
}

export async function getUnreadCount(): Promise<{ unreadCount: number }> {
  return api.get<{ unreadCount: number }>(notificationsPaths.unreadCount);
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(notificationsPaths.read(id));
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean; markedCount: number }> {
  return api.post<{ ok: boolean; markedCount: number }>(notificationsPaths.readAll);
}
