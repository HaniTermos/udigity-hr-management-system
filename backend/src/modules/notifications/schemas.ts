/**
 * MOD-notifications — Zod request schemas (.strict()) and VT-3 action declarations. Owner: BE5.
 * Contract: docs/implementation/plan.md §4.1, docs/security/authz-matrix.md §3.9.
 */
import { z } from 'zod';
import { safeString } from '../../shared/validation.js';
import { defineMatrixActions } from '../access/matrix.js';

export const NOTIFICATION_ACTIONS = defineMatrixActions([
  'notification.list',
  'notification.mark_read',
  'reminder.monitor.read',
  'reminder.send_again',
] as const);

export const MarkReadParamSchema = z.object({ id: safeString().uuid() }).strict();
export const ReminderParamSchema = z.object({ id: safeString().uuid() }).strict();

export interface NotificationDto {
  id: string;
  template: string;
  channel: 'email' | 'in_app';
  recipientId: string;
  sourceType: string | null;
  sourceId: string | null;
  state: 'pending' | 'retry_pending' | 'sent' | 'accepted' | 'captured' | 'failed' | 'suppressed' | 'skipped';
  readAt: string | null;
  createdAt: string;
  title: string;
  message: string;
  link?: string;
}

export interface DeliveryMonitorItemDto {
  id: string;
  kind: 'reminder' | 'notification' | 'provisioning';
  family: string;
  templateOrSource: string;
  recipientName: string;
  recipientEmail: string;
  channel: string;
  /** E-mail: `accepted` = provider accepted (not confirmed delivery), `captured` = log/test sink only. */
  state: string;
  attemptCount: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  createdAt: string;
}
