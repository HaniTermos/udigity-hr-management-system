/**
 * Transactional outbox + email CONTRACT (ADR-007, arch-a §4.6; plan.md §7). Owner: Tech Lead.
 * Implementation: BE5 (`modules/platform` = outbox table + relay J-03; `modules/notifications` =
 * consumers, NotificationDelivery, Reminder, email transport).
 *
 * Rules
 * - A command writes outbox events INSIDE its transaction (`outbox.emit(ctx.tx, ...)`), next to its
 *   audit row. It never inserts rows owned by another module.
 * - Payloads carry ids only (no names, phones, notes): consumers re-read what they need and re-check
 *   recipient status + access at send time (C6).
 * - Consumers are idempotent per event id. The relay retries until they succeed.
 * - No email is ever sent inside a transaction. Default transport is `log` (no network).
 */
import type { Queryable } from '../db/pool.js';
import type { CommandContext } from './tx.js';

/** Canonical outbox events E-01..E-17 (arch-a §4.6.1). Adding a name needs a TL REQUEST. */
export const OUTBOX_EVENTS = [
  'account.created', // E-01
  'account.deactivated', // E-02
  'account.role_changed', // E-02
  'password_reset.requested', // E-03
  'password_reset.assistance_triggered', // E-03
  'password_reset.completed', // E-04
  'two_factor.recovery_succeeded', // E-04
  'follow_up.scheduled', // E-05
  'follow_up.rescheduled',
  'follow_up.reassigned',
  'follow_up.completed',
  'follow_up.cancelled',
  'meeting.scheduled', // E-06
  'meeting.rescheduled',
  'meeting.cancelled',
  'meeting.held',
  'meeting.missed',
  'calling_assignment.assigned', // E-07
  'calling_assignment.reassigned',
  'contact_reservation.overridden', // BL-03 / BE3-R1: holder notice, B3-Q14 DEMO (placeholder name, G2)
  'opportunity.developer_assigned', // E-08
  'opportunity.developer_reassigned',
  'data_correction_request.submitted', // E-09
  'data_correction_request.resolved', // BL-17: requester notice (placeholder name, G2)
  'data_correction_request.rejected', // BL-17: requester notice (placeholder name, G2)
  'data_correction_request.closed', // BL-17: requester notice (placeholder name, G2)
  'attendance_correction.submitted', // E-10
  'attendance.checkout_provisional', // E-11
  'attendance.checkout_pending_review',
  'attendance.missing_checkin_detected', // E-12 (placeholder names, need approval)
  'attendance.missing_checkout_detected',
  'attendance.missing_checkout_reminder', // D18: employee at shift end + 1 h (placeholder name, G2)
  'deal.closure_requested', // E-13
  'deal.closed', // E-14
  'deal.closure_rejected', // ORCH-2 (3): accepted for BE4 (placeholder name, G2)
  'deal.not_proceeding', // ORCH-2 (3): accepted for BE4 (placeholder name, G2)
  'project.provisioning_failed', // E-15
  'call_outcome.changed', // E-16
  'business.duplicate_review_requested', // D10 (approved 2026-10-29): Owner in-app notice; placeholder name (G2)
  'reminder.failed', // E-17
  'reminder.suppressed',
  'notification.failed',
  'notification.suppressed',
] as const;

export type OutboxEventName = (typeof OUTBOX_EVENTS)[number];

export type OutboxPayload = Record<string, string | number | boolean | null>;

export interface OutboxEvent {
  name: OutboxEventName;
  aggregateType: string;
  aggregateId: string;
  /** Ids and small scalars only. Never secrets, never free text. */
  payload?: OutboxPayload;
}

export interface DeliveredEvent extends Required<OutboxEvent> {
  id: string;
  createdAt: Date;
  attempt: number;
}

export interface OutboxWriter {
  /** Insert one event in the caller's transaction. Returns the event id. */
  emit(tx: Queryable, event: OutboxEvent): Promise<string>;
}

/** A consumer runs in its own transaction per event (`ctx.actor.kind === 'system'`). */
export interface OutboxConsumer {
  /** Unique, e.g. `identity.revoke_sessions`. Used for per-consumer idempotency. */
  name: string;
  events: readonly OutboxEventName[];
  handle(ctx: CommandContext, event: DeliveredEvent): Promise<void>;
}

const consumers: OutboxConsumer[] = [];

export function registerOutboxConsumer(consumer: OutboxConsumer): void {
  if (consumers.some((c) => c.name === consumer.name)) throw new Error(`Outbox consumer registered twice: ${consumer.name}`);
  consumers.push(consumer);
}

export function getOutboxConsumers(): readonly OutboxConsumer[] {
  return consumers;
}

// Fail loud until BE5 registers the writer: a command that needs the outbox rolls back instead of
// silently dropping a side effect.
let writer: OutboxWriter = {
  async emit(_tx, event) {
    throw new Error(`Outbox writer not registered (event ${event.name}); BE5 platform module must init first`);
  },
};

export function registerOutboxWriter(next: OutboxWriter): void {
  writer = next;
}

export const outbox: OutboxWriter = {
  emit: (tx, event) => writer.emit(tx, event),
};

// ---------------------------------------------------------------------------
// Email (nodemailer behind an interface; plan.md §7.2)
// ---------------------------------------------------------------------------

/** Template ids. Families: `security` (no business access check) and `business`. */
export type EmailTemplateId =
  | 'security.credential_setup'
  | 'security.password_reset'
  | 'security.password_reset_completed'
  | 'business.follow_up_reminder'
  | 'business.meeting_reminder'
  | 'business.assignment'
  | 'business.developer_handoff'
  | 'business.correction_request'
  | 'business.attendance_alert'
  | 'business.delivery_failure'
  | 'ops.alert';

export interface EmailMessage {
  to: string;
  template: EmailTemplateId;
  /** Template variables. Built at send time from fields the recipient may see. */
  vars: Record<string, string>;
  /** Passed to the provider where supported (at-least-once delivery, arch-a §4.2). */
  idempotencyKey: string;
}

export type EmailSendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; permanent: boolean; error: string };

/**
 * `log` (dev: writes a redacted line, no network) | `memory` (tests) | `smtp` (nodemailer, env SMTP_*) |
 * `none` (production without a real sender: nothing is sent, J-02 records the delivery as failed).
 * A successful `smtp` send means "accepted by the provider"; `log`/`memory` only capture the message.
 */
export interface EmailTransport {
  readonly kind: 'log' | 'smtp' | 'memory' | 'none';
  send(message: EmailMessage): Promise<EmailSendResult>;
}
