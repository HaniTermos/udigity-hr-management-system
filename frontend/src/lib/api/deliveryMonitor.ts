/**
 * deliveryMonitor API — backend MOD-notifications (BE5).
 * Screens: SCR-OWN-012 delivery & exception monitor.
 */
import { api } from './client';
import type { Page } from './types';

export const deliveryMonitorPaths = {
  list: '/api/delivery-monitor',
  sendAgain: (reminderId: string) => `/api/delivery-monitor/reminders/${reminderId}/send-again`,
} as const;

export interface DeliveryMonitorItem {
  id: string;
  kind: 'reminder' | 'notification' | 'provisioning';
  family: string;
  templateOrSource: string;
  recipientName: string;
  recipientEmail: string;
  channel: string;
  state: string;
  attemptCount: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export async function listDeliveryMonitor(options: {
  kind?: 'reminder' | 'notification' | 'provisioning';
  /** Server state filter, e.g. `failed` or `pending` (unknown values are ignored by the server). */
  state?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Page<DeliveryMonitorItem>> {
  return api.get<Page<DeliveryMonitorItem>>(deliveryMonitorPaths.list, {
    query: {
      kind: options.kind,
      state: options.state,
      page: options.page,
      pageSize: options.pageSize,
    },
  });
}

export async function retryReminder(id: string): Promise<{ ok: boolean; message: string }> {
  return api.post<{ ok: boolean; message: string }>(deliveryMonitorPaths.sendAgain(id));
}
