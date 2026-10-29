/**
 * MOD-notifications — service. Owner: BE5.
 * Increment 2: Security email (E-03) + J-02 email dispatch.
 * Increment 6: In-app inbox (AR-14), delivery monitor (SCR-OWN-012, AR-13), reminder planner (E-05, E-06, J-01),
 * and notification consumers for business events.
 */
import { config } from '../../config/index.js';
import { pool, type Queryable } from '../../db/pool.js';
import { getSetting } from '../admin/service.js';
import { notFound, stateConflict } from '../../shared/errors.js';
import { outbox, type DeliveredEvent, type EmailMessage, type EmailTemplateId, type OutboxConsumer } from '../../shared/outbox.js';
import type { CommandContext } from '../../shared/tx.js';
import { access, type Action, type Principal, type ResourceType } from '../../shared/access.js';
import { flags } from '../../shared/flags.js';
import { audit } from '../../shared/tx.js';
import { clock } from '../platform/clock.js';
import { errorSummary, runSystemTx } from '../platform/service.js';
import * as repo from './repo.js';
import { decryptSecret, encryptSecret } from './secrets.js';
import { EMAIL_NOT_CONFIGURED } from './emailConfig.js';
import { getEmailTransport } from './transport.js';
import type { DeliveryMonitorItemDto, NotificationDto } from './schemas.js';
import { currentSchedule, employeeSchedule } from '../attendance/service.js';
import { addDays, missingSettings, nonWorkingReason, REQUIRED_MINUTES, shiftEndAt, workDateOf, zonedToUtc, type Schedule } from '../attendance/time.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** EM-7: at most 3 password-reset emails per account per hour. */
export const RESET_EMAILS_PER_HOUR = 3;

// ---------------------------------------------------------------------------
// Public op for identity (call inside the command transaction)
// ---------------------------------------------------------------------------

export async function stashSecuritySecret(tx: Queryable, securityTokenId: string, rawToken: string, expiresAt: Date): Promise<void> {
  if (!UUID_RE.test(securityTokenId)) throw new Error('securityTokenId must be a UUID');
  await repo.insertSecret(tx, securityTokenId, encryptSecret(rawToken, securityTokenId), expiresAt);
}

export async function queuePasswordResetEmail(
  tx: Queryable,
  p: { employeeId: string; securityTokenId: string; rawToken: string; expiresAt: Date }
): Promise<string> {
  await stashSecuritySecret(tx, p.securityTokenId, p.rawToken, p.expiresAt);
  return outbox.emit(tx, {
    name: 'password_reset.requested',
    aggregateType: 'employee',
    aggregateId: p.employeeId,
    payload: { securityTokenId: p.securityTokenId },
  });
}

// ---------------------------------------------------------------------------
// E-03 security email consumer
// ---------------------------------------------------------------------------

export const securityEmailConsumer: OutboxConsumer = {
  name: 'notifications.security_email',
  events: ['password_reset.requested', 'account.created'],
  async handle(ctx: CommandContext, event: DeliveredEvent) {
    const tokenId = event.payload.securityTokenId;
    if (typeof tokenId !== 'string' || !UUID_RE.test(tokenId)) throw new Error('Security email payload needs securityTokenId');
    const recipientId = event.aggregateId;
    const contact = await repo.recipientContact(ctx.tx, recipientId);
    if (!contact) throw new Error('Security email recipient not found');

    const isAccountSetup = event.name === 'account.created';
    const template = isAccountSetup ? 'security.credential_setup' : 'security.password_reset';
    const dedupeKey = isAccountSetup ? `e01:${tokenId}` : `e03:${tokenId}`;

    let state: repo.DeliveryState = 'pending';
    let reason: string | null = null;
    if (!contact.isActive) {
      state = 'suppressed';
      reason = 'recipient inactive';
    } else if (!isAccountSetup) {
      const since = new Date(ctx.now.getTime() - 3600_000);
      const recent = await repo.countRecentSecurityEmails(ctx.tx, recipientId, 'security.password_reset', since);
      if (recent >= RESET_EMAILS_PER_HOUR) {
        state = 'suppressed';
        reason = 'per-account reset email limit';
      }
    }

    const id = await repo.insertDelivery(
      ctx.tx,
      {
        dedupeKey,
        eventId: event.id,
        family: 'security',
        template,
        channel: 'email',
        recipientId,
        sourceType: 'security_token',
        sourceId: tokenId,
        state,
        lastError: reason,
      },
      ctx.now
    );
    if (id && state === 'suppressed') {
      await repo.consumeSecret(ctx.tx, tokenId, ctx.now);
      await emitDeliveryOutcome(ctx.tx, id, template, 'suppressed', 'security');
    }
  },
};

// ---------------------------------------------------------------------------
// In-App Notifications (AR-14)
// ---------------------------------------------------------------------------

/** A non-negative integer from a stored summary (0 otherwise). */
const count = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

/** 1440 → "24 hours", 60 → "1 hour", 90 → "90 minutes"; null when unknown. */
function leadLabel(minutes: number): string | null {
  if (minutes <= 0) return null;
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const h = minutes / 60;
  return h === 1 ? '1 hour' : `${h} hours`;
}

function formatNotification(d: repo.DeliveryRow): NotificationDto {
  let title = 'System Notification';
  let message = 'You have a new update.';
  let link: string | undefined;

  switch (d.template) {
    case 'business.assignment':
      title = 'New Calling Assignment';
      message = 'A new business portfolio has been assigned to you.';
      link = '/queue';
      break;
    case 'business.developer_handoff':
      title = 'Opportunity Handed Off';
      message = 'An accepted opportunity has been assigned to your development workload.';
      link = d.source_id ? `/deals/${d.source_id}` : '/deals';
      break;
    case 'business.follow_up_reminder':
      title = 'Follow-up Due';
      message = 'You have a scheduled follow-up call due soon.';
      link = '/calendar';
      break;
    case 'business.follow_up_overdue':
      title = 'Follow-up Overdue';
      message = 'A follow-up call assigned to you is more than an hour overdue.';
      link = '/calendar';
      break;
    case 'business.follow_up_digest': {
      const n = count(d.summary?.dueToday);
      title = "Today's Follow-ups";
      message = n === 1 ? 'You have 1 follow-up call due today.' : `You have ${n} follow-up calls due today.`;
      link = '/calendar';
      break;
    }
    case 'business.owner_digest': {
      const overdue = count(d.summary?.overdueFollowUps);
      const missing = count(d.summary?.missingCheckouts);
      const parts: string[] = [];
      if (overdue > 0) parts.push(`${overdue} overdue follow-up${overdue === 1 ? '' : 's'}`);
      if (missing > 0) parts.push(`${missing} missing checkout${missing === 1 ? '' : 's'} from the previous working day`);
      title = 'Morning Digest';
      message = parts.length > 0 ? `Waiting for review: ${parts.join(' and ')}.` : 'Nothing is waiting for review.';
      link = missing > 0 && overdue === 0 ? '/attendance' : '/calendar';
      break;
    }
    case 'business.meeting_reminder': {
      const lead = count(d.summary?.leadMinutes);
      const when = leadLabel(lead);
      title = 'Meeting Reminder';
      if (d.source_type === 'business') {
        // Redacted (D15): the recipient may see the business but not the deal or meeting.
        message = when ? `A client meeting for one of your assigned businesses starts in ${when}.` : 'A client meeting for one of your assigned businesses is coming up.';
        link = '/queue';
      } else {
        message = when ? `An upcoming commercial discovery meeting starts in ${when}.` : 'An upcoming commercial discovery meeting is scheduled.';
        link = '/meetings';
      }
      break;
    }
    case 'business.correction_request':
      title = 'Correction Request Update';
      message = 'A data correction request has an update.';
      link = '/corrections';
      break;
    case 'business.attendance_alert':
      title = 'Attendance Alert';
      message = 'An attendance check notice or correction review is pending.';
      link = '/my-attendance';
      break;
    case 'business.reservation_overridden':
      title = 'Reservation Overridden';
      message = 'Your contact lease on a business was overridden by an Owner.';
      link = '/queue';
      break;
    case 'business.attendance_review':
      title = 'Attendance Review';
      message = 'An attendance item is waiting for your review.';
      link = '/attendance';
      break;
    case 'business.deal_closure_rejected':
      title = 'Closure Verification Rejected';
      message = 'The closure verification for a deal was rejected. Check the deal for the reason.';
      link = d.source_id ? `/deals/${d.source_id}` : '/deals';
      break;
    case 'business.provisioning_failed':
      title = 'Project Provisioning Failed';
      message = 'A closed deal could not create its project. It is retried automatically.';
      link = '/projects';
      break;
    case 'business.duplicate_review':
      title = 'Duplicate Review Requested';
      message = 'An employee asked you to review a blocked duplicate business.';
      link = d.source_id ? `/businesses/${d.source_id}` : '/businesses';
      break;
    case 'business.delivery_failure': {
      const n = count(d.summary?.count) || 1;
      title = 'Delivery Failed';
      message = n > 1 ? `${n} notifications or reminders of the same kind could not be delivered.` : 'A notification or reminder could not be delivered.';
      link = '/delivery-monitor';
      break;
    }
    case 'security.recovery_code_used':
      title = 'Recovery Code Used';
      message = 'A recovery code was used to sign in to your account. If this was not you, contact the Owner.';
      link = '/profile';
      break;
    case 'business.deal_closure':
      title = 'Deal Closure Verification';
      message = 'A deal closure request is awaiting review or has completed.';
      link = d.source_id ? `/deals/${d.source_id}` : '/deals';
      break;
    default:
      if (d.template.startsWith('security.')) {
        title = 'Security Alert';
        message = 'A security event was recorded on your account.';
      }
      break;
  }

  return {
    id: d.id,
    template: d.template,
    channel: d.channel,
    recipientId: d.recipient_id,
    sourceType: d.source_type,
    sourceId: d.source_id,
    state: d.state,
    readAt: d.read_at ? d.read_at.toISOString() : null,
    createdAt: d.created_at.toISOString(),
    title,
    message,
    link,
  };
}

/** Source types whose access is re-checked when the inbox is read (AR-14 / R2-16). */
const RECHECKED_SOURCES: Record<string, { type: ResourceType; action: string }> = {
  business: { type: 'business', action: 'business.read' },
  deal: { type: 'deal', action: 'deal.read' },
  meeting: { type: 'meeting', action: 'meeting.read' },
  follow_up: { type: 'follow_up', action: 'follow_up.read' },
  project: { type: 'project', action: 'project.read' },
};

/** Newest in-app rows considered by the inbox (the list shows a recent window, not the archive). */
const INBOX_WINDOW = 500;

async function visibleInApp(db: Queryable, principal: Principal, unreadOnly: boolean): Promise<repo.DeliveryRow[]> {
  const { items } = await repo.listInAppDeliveries(db, principal.employeeId, { unreadOnly, limit: INBOX_WINDOW, offset: 0 });
  const hidden = new Set<string>();
  for (const [sourceType, spec] of Object.entries(RECHECKED_SOURCES)) {
    const ids = [...new Set(items.filter((d) => d.source_type === sourceType && d.source_id).map((d) => d.source_id as string))];
    if (ids.length === 0) continue;
    const decisions = await access.checkMany(db, principal, spec.action as Action, ids.map((id) => ({ type: spec.type, id })));
    for (const id of ids) if (!decisions.get(id)?.allowed) hidden.add(`${sourceType}:${id}`);
  }
  return items.filter((d) => !(d.source_type && d.source_id && hidden.has(`${d.source_type}:${d.source_id}`)));
}

/** AR-14: access is re-checked when the list is read; hidden items are omitted and not counted. */
export async function listMyNotifications(
  db: Queryable,
  principal: Principal,
  options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
): Promise<{ items: NotificationDto[]; total: number }> {
  const rows = await visibleInApp(db, principal, Boolean(options.unreadOnly));
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;
  return { items: rows.slice(offset, offset + limit).map(formatNotification), total: rows.length };
}

export async function getMyUnreadCount(db: Queryable, principal: Principal): Promise<number> {
  return (await visibleInApp(db, principal, true)).length;
}

export async function markAsRead(db: Queryable, principal: Principal, id: string): Promise<boolean> {
  const success = await repo.markDeliveryRead(db, id, principal.employeeId, clock.now());
  if (!success) {
    const existing = await repo.getDelivery(db, id);
    if (!existing || existing.recipient_id !== principal.employeeId) {
      throw notFound();
    }
  }
  return true;
}

export async function markAllAsRead(db: Queryable, principal: Principal): Promise<number> {
  return repo.markAllDeliveriesRead(db, principal.employeeId, clock.now());
}

// ---------------------------------------------------------------------------
// Delivery Monitor (SCR-OWN-012, AR-13)
// ---------------------------------------------------------------------------

export async function listDeliveryMonitor(
  db: Queryable,
  options: { kind?: 'reminder' | 'notification' | 'provisioning'; limit?: number; offset?: number } = {}
): Promise<{ items: DeliveryMonitorItemDto[]; total: number }> {
  const { items, total } = await repo.listDeliveryMonitorRows(db, options);
  return {
    items: items.map((r) => ({
      id: r.id,
      kind: r.kind,
      family: r.family,
      templateOrSource: r.template_or_source,
      recipientName: r.recipient_name,
      recipientEmail: r.recipient_email,
      channel: r.channel,
      state: r.state,
      attemptCount: r.attempt_count,
      lastError: r.last_error,
      nextAttemptAt: r.next_attempt_at ? r.next_attempt_at.toISOString() : null,
      sentAt: r.sent_at ? r.sent_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
    })),
    total,
  };
}

/** R2-15: at most this many manual re-sends per row. */
export const SEND_AGAIN_MAX = 3;

/**
 * POST /api/delivery-monitor/reminders/:id/send-again (AR-13, R2-15). Only `failed`, `suppressed` or
 * `skipped` e-mail deliveries and `failed` / `suppressed` reminders can be re-queued; `sent`, `accepted`,
 * `captured`, `cancelled`, pending and in-app rows answer 409. At most SEND_AGAIN_MAX re-sends per row; each one is
 * audited (`notification.send_again_requested`). The send-time re-check still applies when it runs.
 */
export async function retryMonitorItem(ctx: CommandContext, id: string): Promise<{ success: boolean; kind: 'delivery' | 'reminder' }> {
  const { rows: prior } = await ctx.tx.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM audit_events WHERE event_name = 'notification.send_again_requested' AND entity_id = $1`,
    [id]
  );
  const used = Number(prior[0]?.n ?? 0);
  const delivery = await ctx.tx.query<{ state: string; channel: string }>('SELECT state, channel FROM notification_deliveries WHERE id = $1 FOR UPDATE', [id]);
  const reminder = delivery.rows[0] ? null : await ctx.tx.query<{ state: string }>('SELECT state FROM reminders WHERE id = $1 FOR UPDATE', [id]);
  const kind: 'delivery' | 'reminder' | null = delivery.rows[0] ? 'delivery' : reminder?.rows[0] ? 'reminder' : null;
  if (!kind) throw notFound();
  const state = kind === 'delivery' ? delivery.rows[0].state : reminder!.rows[0].state;
  const allowed =
    kind === 'delivery'
      ? delivery.rows[0].channel === 'email' && ['failed', 'suppressed', 'skipped'].includes(state)
      : ['failed', 'suppressed'].includes(state);
  if (!allowed) throw stateConflict('Only a failed or suppressed item can be sent again', { state });
  if (used >= SEND_AGAIN_MAX) throw stateConflict(`This item was already sent again ${SEND_AGAIN_MAX} times`, { limit: SEND_AGAIN_MAX });
  const ok = kind === 'delivery' ? await repo.retryDelivery(ctx.tx, id, ctx.now) : await repo.retryReminder(ctx.tx, id, ctx.now);
  if (!ok) throw stateConflict('The item changed; reload and try again');
  await audit(ctx, {
    eventName: 'notification.send_again_requested',
    entityType: kind === 'delivery' ? 'notification_delivery' : 'reminder',
    entityId: id,
    before: { state },
    after: { state: 'pending' },
    payload: { attempt: used + 1, limit: SEND_AGAIN_MAX },
  });
  return { success: true, kind };
}

// ---------------------------------------------------------------------------
// Business Events & Reminder Planner Consumers (Increment 6)
// ---------------------------------------------------------------------------

export const reminderPlannerConsumer: OutboxConsumer = {
  name: 'notifications.reminder_planner',
  events: [
    'follow_up.scheduled',
    'follow_up.rescheduled',
    'follow_up.reassigned',
    'follow_up.completed',
    'follow_up.cancelled',
    'meeting.scheduled',
    'meeting.rescheduled',
    'meeting.cancelled',
    'meeting.held',
    'meeting.missed',
    'opportunity.developer_assigned',
    'opportunity.developer_reassigned',
    'calling_assignment.assigned',
    'calling_assignment.reassigned',
  ],
  async handle(ctx: CommandContext, event: DeliveredEvent) {
    const { name, aggregateType, aggregateId } = event;
    const lateReminder = flags['notifications.lateReminder'];
    /** B3-Q08: a lead time already passed → remind now while the event is still ahead, or skip. */
    const plan = (eventAt: Date, leadMinutes: number): Date | null => {
      const at = new Date(eventAt.getTime() - leadMinutes * 60_000);
      if (at.getTime() >= ctx.now.getTime()) return at;
      if (eventAt.getTime() <= ctx.now.getTime()) return null;
      return lateReminder === 'skip' ? null : ctx.now;
    };

    if (aggregateType === 'follow_up') {
      if (name === 'follow_up.completed' || name === 'follow_up.cancelled') {
        await repo.cancelRemindersForSource(ctx.tx, 'follow_up', aggregateId);
        return;
      }
      // Columns are responsible_id / scheduled_for (migration 340).
      const { rows } = await ctx.tx.query<{ id: string; responsible_id: string; scheduled_for: Date }>(
        `SELECT id, responsible_id, scheduled_for FROM follow_ups WHERE id = $1 AND state = 'scheduled'`,
        [aggregateId]
      );
      const fup = rows[0];
      if (!fup) return;
      // D18 overdue: the current assignee, once per due time, `followUpOverdueAlertMinutes` (60) after it.
      // Stored as a follow-up reminder with a negative lead; already past (e.g. late reassignment) → now.
      const overdueMinutes = await getSetting(ctx.tx, 'notifications.followUpOverdueAlertMinutes');
      const overdueAt = new Date(fup.scheduled_for.getTime() + overdueMinutes * 60_000);
      await repo.upsertOverdueReminder(ctx.tx, {
        dedupeKey: `rem:fupod:${fup.id}:${fup.scheduled_for.getTime()}`,
        sourceId: fup.id,
        recipientId: fup.responsible_id,
        scheduledFor: overdueAt.getTime() >= ctx.now.getTime() ? overdueAt : ctx.now,
        leadMinutes: -overdueMinutes,
      });
      // D18 due: the current assignee, `followUpLeadMinutes` (15) before.
      const leadMinutes = await getSetting(ctx.tx, 'notifications.followUpLeadMinutes');
      const scheduledFor = plan(fup.scheduled_for, leadMinutes);
      if (!scheduledFor) {
        // Only the "due" reminder: the overdue alert above stays armed.
        await ctx.tx.query(`UPDATE reminders SET state = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE dedupe_key = $1 AND state = 'pending'`, [
          `rem:fup:${fup.id}`,
        ]);
        return;
      }
      await repo.upsertReminder(ctx.tx, {
        dedupeKey: `rem:fup:${fup.id}`,
        sourceType: 'follow_up',
        sourceId: fup.id,
        recipientId: fup.responsible_id,
        scheduledFor,
        leadMinutes,
      });
    } else if (aggregateType === 'meeting') {
      if (name === 'meeting.cancelled' || name === 'meeting.held' || name === 'meeting.missed') {
        await repo.cancelRemindersForSource(ctx.tx, 'meeting', aggregateId);
        return;
      }
      await planMeetingReminders(ctx, aggregateId, plan, name !== 'meeting.rescheduled');
    } else if (name === 'opportunity.developer_assigned' || name === 'opportunity.developer_reassigned') {
      // D18: the deal's current Developer is a meeting-reminder recipient; re-plan its open meetings.
      const { rows } = await ctx.tx.query<{ id: string }>(`SELECT id FROM meetings WHERE deal_id = $1 AND status = 'scheduled'`, [aggregateId]);
      for (const m of rows) await planMeetingReminders(ctx, m.id, plan, true);
    } else if (name === 'calling_assignment.assigned' || name === 'calling_assignment.reassigned') {
      // D18: the business's assigned Call Center agent is a meeting-reminder recipient.
      const businessId = str(event.payload.businessId);
      if (!businessId) return;
      const { rows } = await ctx.tx.query<{ id: string }>(`SELECT id FROM meetings WHERE business_id = $1 AND status = 'scheduled'`, [businessId]);
      for (const m of rows) await planMeetingReminders(ctx, m.id, plan, true);
    }
  },
};

/**
 * D18 meeting-reminder recipients: the deal's current assigned Developer and the business's current
 * assigned Call Center agent, plus the meeting's current attendees (R2-13 / R3-29). Active accounts only;
 * each recipient's access is re-checked when the reminder is sent (C6).
 */
async function meetingReminderRecipients(db: Queryable, meetingId: string): Promise<string[]> {
  const { rows } = await db.query<{ employee_id: string | null }>(
    `SELECT d.assigned_developer_id AS employee_id
       FROM meetings m JOIN deals d ON d.id = m.deal_id WHERE m.id = $1
     UNION
     SELECT ca.assignee_id FROM meetings m
       JOIN calling_assignments ca ON ca.business_id = m.business_id AND ca.ended_at IS NULL WHERE m.id = $1
     UNION
     SELECT a.employee_id FROM meeting_attendees a WHERE a.meeting_id = $1 AND a.removed_at IS NULL`,
    [meetingId]
  );
  return activeOnly(db, rows.map((r) => r.employee_id));
}

/** `keepSent`: a reminder already sent for the current start time is not repeated (recipient re-plans). */
async function planMeetingReminders(
  ctx: CommandContext,
  meetingId: string,
  plan: (eventAt: Date, leadMinutes: number) => Date | null,
  keepSent: boolean
): Promise<void> {
  const { rows: meetings } = await ctx.tx.query<{ id: string; starts_at: Date }>(
    `SELECT id, starts_at FROM meetings WHERE id = $1 AND status = 'scheduled'`,
    [meetingId]
  );
  const meeting = meetings[0];
  if (!meeting) return;
  const current = await meetingReminderRecipients(ctx.tx, meeting.id);
  // Reminders of people who are no longer recipients are cancelled.
  await ctx.tx.query(
    `UPDATE reminders SET state = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE source_type = 'meeting' AND source_id = $1 AND state = 'pending' AND NOT (recipient_id = ANY($2::uuid[]))`,
    [meeting.id, current]
  );
  const leads = [...new Set(await getSetting(ctx.tx, 'notifications.meetingLeadMinutes'))];
  for (const employeeId of current) {
    for (const leadMinutes of leads) {
      const key = `rem:meet:${meeting.id}:${employeeId}:${leadMinutes}`;
      const scheduledFor = plan(meeting.starts_at, leadMinutes);
      if (!scheduledFor) {
        await ctx.tx.query(`UPDATE reminders SET state = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE dedupe_key = $1 AND state = 'pending'`, [key]);
        continue;
      }
      if (keepSent) {
        const { rows: sent } = await ctx.tx.query<{ id: string }>(
          `SELECT id FROM reminders WHERE dedupe_key = $1 AND state = 'sent' AND scheduled_for >= $2`,
          [key, new Date(meeting.starts_at.getTime() - leadMinutes * 60_000)]
        );
        if (sent[0]) continue;
      }
      await repo.upsertReminder(ctx.tx, {
        dedupeKey: key,
        sourceType: 'meeting',
        sourceId: meeting.id,
        recipientId: employeeId,
        scheduledFor,
        leadMinutes,
      });
    }
  }
}

/** Active employees among `ids` (in-app notices go to active accounts only, C6). */
async function activeOnly(db: Queryable, ids: (string | null | undefined)[]): Promise<string[]> {
  const unique = [...new Set(ids.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x)))];
  if (unique.length === 0) return [];
  const { rows } = await db.query<{ id: string }>('SELECT id FROM employees WHERE id = ANY($1::uuid[]) AND is_active = true', [unique]);
  return rows.map((r) => r.id);
}

async function activeByRole(db: Queryable, role: string): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>('SELECT id FROM employees WHERE role = $1 AND is_active = true ORDER BY id', [role]);
  return rows.map((r) => r.id);
}

/**
 * Insert one in-app notice per recipient. In-app rows are delivered by being written, so they are
 * stored as `sent` (F-25); with `notifications.inApp = false` they are recorded as `suppressed`.
 */
async function notifyInApp(
  ctx: CommandContext,
  event: DeliveredEvent,
  n: { key: string; template: string; family?: 'security' | 'business'; recipients: string[]; sourceType: string | null; sourceId: string | null }
): Promise<number> {
  const enabled = await getSetting(ctx.tx, 'notifications.inApp');
  let created = 0;
  for (const recipientId of n.recipients) {
    const id = await repo.insertDelivery(
      ctx.tx,
      {
        dedupeKey: `notif:${n.key}:${event.id}:${recipientId}`,
        eventId: event.id,
        family: n.family ?? 'business',
        template: n.template,
        channel: 'in_app',
        recipientId,
        sourceType: n.sourceType,
        sourceId: n.sourceId,
        state: enabled ? 'sent' : 'suppressed',
        lastError: enabled ? null : 'in-app notifications are off',
      },
      ctx.now
    );
    if (id) created++;
  }
  return created;
}

const str = (v: unknown): string | null => (typeof v === 'string' && UUID_RE.test(v) ? v : null);

/**
 * D18 data-correction recipient: the business's creator when that account is active and may still review
 * corrections on the business (C6 / D9 access re-check at send time), else null. Owners are added separately.
 */
async function responsibleDataEntry(db: Queryable, creatorId: string | null, businessId: string): Promise<string | null> {
  if (!creatorId) return null;
  const { rows } = await db.query<{ role: string }>('SELECT role FROM employees WHERE id = $1 AND is_active = true', [creatorId]);
  if (!rows[0] || rows[0].role === 'owner') return null;
  const principal: Principal = { employeeId: creatorId, role: rows[0].role as Principal['role'], sessionState: 'active' };
  const decision = await access.check(db, principal, 'correction.review', { type: 'business', id: businessId });
  return decision.allowed ? creatorId : null;
}

/** D18: an open failure alert is merged into for this long (or until the Owner reads it). */
export const FAILURE_ALERT_WINDOW_HOURS = 24;

/** Failure group: the failed delivery's template, or the failed reminder's source type. */
async function failureGroup(db: Queryable, sourceType: 'reminder' | 'notification_delivery', id: string): Promise<string> {
  if (sourceType === 'reminder') {
    const { rows } = await db.query<{ source_type: string }>('SELECT source_type FROM reminders WHERE id = $1', [id]);
    return `reminder:${rows[0]?.source_type ?? 'unknown'}`;
  }
  const { rows } = await db.query<{ template: string }>('SELECT template FROM notification_deliveries WHERE id = $1', [id]);
  return `delivery:${rows[0]?.template ?? 'unknown'}`;
}

async function notifyDeliveryFailure(
  ctx: CommandContext,
  event: DeliveredEvent,
  sourceType: 'reminder' | 'notification_delivery',
  recipients: string[]
): Promise<void> {
  const group = await failureGroup(ctx.tx, sourceType, event.aggregateId);
  const enabled = await getSetting(ctx.tx, 'notifications.inApp');
  const since = new Date(ctx.now.getTime() - FAILURE_ALERT_WINDOW_HOURS * 3600_000);
  for (const recipientId of recipients) {
    await repo.lockKey(ctx.tx, `ntf-failure:${recipientId}:${group}`);
    const open = enabled ? await repo.openFailureAlert(ctx.tx, recipientId, group, since) : null;
    if (open) {
      await repo.bumpFailureAlert(ctx.tx, open.id, event.aggregateId);
      continue;
    }
    await repo.insertDelivery(
      ctx.tx,
      {
        dedupeKey: `notif:delivery_failure:${event.id}:${recipientId}`,
        eventId: event.id,
        family: 'business',
        template: 'business.delivery_failure',
        channel: 'in_app',
        recipientId,
        sourceType,
        sourceId: event.aggregateId,
        state: enabled ? 'sent' : 'suppressed',
        lastError: enabled ? null : 'in-app notifications are off',
        summary: { group, count: 1 },
      },
      ctx.now
    );
  }
}

/**
 * In-app notices for business events (E-07..E-15, E-17, BL-03, BL-17). Payload keys follow the
 * emitters (FX-BE / F-05): `assigneeId`, `holderId`; correction requesters are re-read from the
 * request row (ids-only payloads). Every name listed here has a branch; see `NO_CONSUMER_EVENTS`.
 */
export const businessEventsNotificationConsumer: OutboxConsumer = {
  name: 'notifications.business_events',
  events: [
    'calling_assignment.assigned',
    'calling_assignment.reassigned',
    'opportunity.developer_assigned',
    'opportunity.developer_reassigned',
    'data_correction_request.submitted',
    'data_correction_request.resolved',
    'data_correction_request.rejected',
    'data_correction_request.closed',
    'attendance_correction.submitted',
    'attendance.checkout_provisional',
    'attendance.checkout_pending_review',
    'attendance.missing_checkin_detected',
    'attendance.missing_checkout_detected',
    'attendance.missing_checkout_reminder',
    'contact_reservation.overridden',
    'deal.closure_requested',
    'deal.closed',
    'deal.closure_rejected',
    'project.provisioning_failed',
    'business.duplicate_review_requested',
    'two_factor.recovery_succeeded',
    'notification.failed',
    'notification.suppressed',
    'reminder.failed',
    'reminder.suppressed',
  ],
  async handle(ctx: CommandContext, event: DeliveredEvent) {
    const { name, aggregateId, payload } = event;
    const owners = () => activeByRole(ctx.tx, 'owner');

    switch (name) {
      case 'calling_assignment.assigned':
      case 'calling_assignment.reassigned': {
        // E-07: the new assignee; OWN-008 optionally the previous one.
        const ids = [str(payload.assigneeId) ?? str(payload.agentId)];
        if (name === 'calling_assignment.reassigned' && (await getSetting(ctx.tx, 'notifications.notifyPreviousAssignee'))) {
          ids.push(str(payload.previousAssigneeId));
        }
        await notifyInApp(ctx, event, {
          key: 'assign',
          template: 'business.assignment',
          recipients: await activeOnly(ctx.tx, ids),
          sourceType: 'calling_assignment',
          sourceId: aggregateId,
        });
        return;
      }
      case 'opportunity.developer_assigned':
      case 'opportunity.developer_reassigned':
        await notifyInApp(ctx, event, {
          key: 'dev_handoff',
          template: 'business.developer_handoff',
          recipients: await activeOnly(ctx.tx, [str(payload.developerId)]),
          sourceType: 'deal',
          sourceId: aggregateId,
        });
        return;
      case 'contact_reservation.overridden':
        await notifyInApp(ctx, event, {
          key: 'res_override',
          template: 'business.reservation_overridden',
          recipients: await activeOnly(ctx.tx, [str(payload.holderId) ?? str(payload.previousHolderId)]),
          sourceType: 'reservation',
          sourceId: aggregateId,
        });
        return;
      case 'data_correction_request.submitted': {
        // D18 / E-09: the business's responsible Data Entry employee (its creator, while active and still
        // allowed to review corrections on it) and every active Owner; never the requester.
        const { rows } = await ctx.tx.query<{ requested_by: string; business_id: string; created_by: string | null }>(
          `SELECT r.requested_by, r.business_id, b.created_by
             FROM data_correction_requests r JOIN businesses b ON b.id = r.business_id WHERE r.id = $1`,
          [aggregateId]
        );
        const req = rows[0];
        if (!req) return;
        const recipients = await owners();
        const responsible = await responsibleDataEntry(ctx.tx, req.created_by, req.business_id);
        if (responsible && !recipients.includes(responsible)) recipients.push(responsible);
        await notifyInApp(ctx, event, {
          key: 'correction',
          template: 'business.correction_request',
          recipients: recipients.filter((id) => id !== req.requested_by),
          sourceType: 'data_correction_request',
          sourceId: aggregateId,
        });
        return;
      }
      case 'data_correction_request.resolved':
      case 'data_correction_request.rejected':
      case 'data_correction_request.closed': {
        // BL-17: the requester, re-read from the request (payload carries businessId only).
        const { rows } = await ctx.tx.query<{ requested_by: string }>('SELECT requested_by FROM data_correction_requests WHERE id = $1', [aggregateId]);
        await notifyInApp(ctx, event, {
          key: 'correction',
          template: 'business.correction_request',
          recipients: await activeOnly(ctx.tx, [rows[0]?.requested_by ?? str(payload.requestedBy)]),
          sourceType: 'data_correction_request',
          sourceId: aggregateId,
        });
        return;
      }
      case 'attendance_correction.submitted':
      case 'attendance.checkout_provisional':
      case 'attendance.checkout_pending_review':
        // E-10 / E-11: the Owner review queue (OWN-005).
        await notifyInApp(ctx, event, {
          key: 'att_review',
          template: 'business.attendance_review',
          recipients: (await owners()).filter((id) => id !== str(payload.employeeId)),
          sourceType: name === 'attendance_correction.submitted' ? 'attendance_correction' : 'attendance_session',
          sourceId: str(payload.correctionId) ?? str(payload.sessionId) ?? aggregateId,
        });
        return;
      case 'attendance.missing_checkout_detected':
        // D18: the employee was already reminded at shift end + 1 h; the shift end + 6 h flag only feeds the
        // Owner's review list and the next morning digest (`runDailyDigests`). No second notice.
        return;
      case 'attendance.missing_checkin_detected':
      case 'attendance.missing_checkout_reminder': {
        // E-12: the employee (D18: the checkout reminder at shift end + 1 h).
        const recipients = await activeOnly(ctx.tx, [str(payload.employeeId)]);
        await notifyInApp(ctx, event, {
          key: 'att_alert',
          template: 'business.attendance_alert',
          recipients,
          sourceType: 'attendance_session',
          sourceId: str(payload.sessionId),
        });
        if (name === 'attendance.missing_checkin_detected') {
          // D18 (attendance agent): missing check-in → Owner in-app at shift start + grace + 30 min.
          await notifyInApp(ctx, event, {
            key: 'att_owner',
            template: 'business.attendance_review',
            recipients: (await owners()).filter((id) => !recipients.includes(id)),
            sourceType: 'employee',
            sourceId: str(payload.employeeId),
          });
        }
        return;
      }
      case 'deal.closure_requested':
      case 'deal.closed':
        // E-13 / E-14: active Owners.
        await notifyInApp(ctx, event, { key: 'deal_closure', template: 'business.deal_closure', recipients: await owners(), sourceType: 'deal', sourceId: aggregateId });
        return;
      case 'deal.closure_rejected': {
        // ORCH-2 (3): the assigned Developer and whoever asked for the verification.
        const { rows } = await ctx.tx.query<{ dev: string | null; requester: string | null }>(
          `SELECT d.assigned_developer_id AS dev,
                  (SELECT cr.requested_by_id FROM closure_reviews cr WHERE cr.id = $2::uuid) AS requester
             FROM deals d WHERE d.id = $1`,
          [aggregateId, str(payload.reviewId)]
        );
        await notifyInApp(ctx, event, {
          key: 'deal_closure_rejected',
          template: 'business.deal_closure_rejected',
          recipients: await activeOnly(ctx.tx, [rows[0]?.dev, rows[0]?.requester]),
          sourceType: 'deal',
          sourceId: aggregateId,
        });
        return;
      }
      case 'project.provisioning_failed':
        // E-15: active Owners.
        await notifyInApp(ctx, event, { key: 'provisioning', template: 'business.provisioning_failed', recipients: await owners(), sourceType: 'deal', sourceId: aggregateId });
        return;
      case 'business.duplicate_review_requested':
        // D10 (BE2): "Request Owner review" of a blocking duplicate → active Owners. Grants the requester nothing.
        await notifyInApp(ctx, event, { key: 'dup_review', template: 'business.duplicate_review', recipients: await owners(), sourceType: 'business', sourceId: aggregateId });
        return;
      case 'two_factor.recovery_succeeded':
        // E-04: security notice to the account holder.
        await notifyInApp(ctx, event, {
          key: 'recovery_used',
          template: 'security.recovery_code_used',
          family: 'security',
          recipients: await activeOnly(ctx.tx, [aggregateId]),
          sourceType: 'employee',
          sourceId: aggregateId,
        });
        return;
      case 'notification.failed':
      case 'reminder.failed':
        // E-17 / D6: a delivery failure is an Owner item on the delivery monitor (every failed row stays
        // there). D18: one open in-app alert per Owner and failure group; repeats bump its count.
        await notifyDeliveryFailure(ctx, event, name === 'reminder.failed' ? 'reminder' : 'notification_delivery', await owners());
        return;
      case 'notification.suppressed':
      case 'reminder.suppressed':
        // Suppression is expected (recipient inactive, source closed, access lost): the row on the
        // delivery monitor is the record; no further notice.
        return;
      default:
        return;
    }
  },
};

/**
 * Events emitted with no consumer, on purpose. The contract test checks that every emitted event
 * has a consumer or is listed here with its reason.
 */
export const NO_CONSUMER_EVENTS: Readonly<Record<string, string>> = {
  'call_outcome.changed': 'E-16 reporting-only: kept in the outbox log for reports; no notice in v1',
  'deal.not_proceeding': 'consumed by meetings.cancel_for_deal_not_proceeding (not a notification)',
  'password_reset.assistance_triggered': 'not emitted in v1: no Owner-assisted reset route (review 01 F-15)',
  'password_reset.completed': 'not emitted in v1: the reset ends every session; the security e-mail is E-03 only',
};

// ---------------------------------------------------------------------------
// J-01 Reminder Dispatch Job
// ---------------------------------------------------------------------------

/** Reminders that throw this many times are recorded `failed` (R2-30: no endless re-claim). */
const REMINDER_MAX_ATTEMPTS = 3;

/**
 * `redactTo`: the recipient may not see the meeting (D15: a Call Center agent has no deal / meeting access)
 * but may still see its business, so the notice points at the business and names no deal detail (D18
 * "respect current access when generating notification content").
 */
type ReminderCheck =
  | { ok: true; redactTo?: { sourceType: 'business'; sourceId: string } }
  | { ok: false; state: 'suppressed' | 'cancelled'; reason: string };

/** C6 / HR-7 send-time re-check: recipient active, source still open, recipient still allowed. */
async function recheckReminder(db: Queryable, rem: repo.ReminderRow): Promise<ReminderCheck> {
  const { rows: emp } = await db.query<{ role: string; is_active: boolean }>('SELECT role, is_active FROM employees WHERE id = $1', [rem.recipient_id]);
  if (!emp[0] || !emp[0].is_active) return { ok: false, state: 'suppressed', reason: 'recipient inactive' };
  const principal: Principal = { employeeId: rem.recipient_id, role: emp[0].role as Principal['role'], sessionState: 'active' };
  if (rem.source_type === 'follow_up') {
    const { rows } = await db.query<{ state: string; responsible_id: string }>('SELECT state, responsible_id FROM follow_ups WHERE id = $1', [rem.source_id]);
    if (!rows[0] || rows[0].state !== 'scheduled') return { ok: false, state: 'cancelled', reason: 'follow-up no longer scheduled' };
    if (rows[0].responsible_id !== rem.recipient_id) return { ok: false, state: 'cancelled', reason: 'recipient no longer responsible' };
    const decision = await access.check(db, principal, 'follow_up.read', { type: 'follow_up', id: rem.source_id });
    if (!decision.allowed) return { ok: false, state: 'suppressed', reason: 'recipient may no longer see the source' };
    return { ok: true };
  }
  const { rows } = await db.query<{ status: string; business_id: string }>('SELECT status, business_id FROM meetings WHERE id = $1', [rem.source_id]);
  if (!rows[0] || rows[0].status !== 'scheduled') return { ok: false, state: 'cancelled', reason: 'meeting no longer scheduled' };
  // D18: still the deal's Developer, the business's Call Center agent or an attendee.
  if (!(await meetingReminderRecipients(db, rem.source_id)).includes(rem.recipient_id)) {
    return { ok: false, state: 'cancelled', reason: 'recipient no longer a meeting recipient' };
  }
  const decision = await access.check(db, principal, 'meeting.read', { type: 'meeting', id: rem.source_id });
  if (decision.allowed) return { ok: true };
  const business = await access.check(db, principal, 'business.read', { type: 'business', id: rows[0].business_id });
  if (business.allowed) return { ok: true, redactTo: { sourceType: 'business', sourceId: rows[0].business_id } };
  return { ok: false, state: 'suppressed', reason: 'recipient may no longer see the source' };
}

/** Follow-up reminders with a negative lead are the D18 overdue alert (planned after the due time). */
function reminderTemplate(rem: repo.ReminderRow): string {
  if (rem.source_type === 'meeting') return 'business.meeting_reminder';
  return rem.lead_minutes < 0 ? 'business.follow_up_overdue' : 'business.follow_up_reminder';
}

export async function dispatchDueReminders(): Promise<{ claimed: number; dispatched: number }> {
  const now = clock.now();
  const claimed = await repo.claimDueReminders(pool, now, 25);
  let dispatched = 0;

  for (const rem of claimed) {
    try {
      await runSystemTx('notifications.reminder_dispatch', async (ctx) => {
        const check = await recheckReminder(ctx.tx, rem);
        if (!check.ok) {
          await ctx.tx.query(
            `UPDATE reminders SET state = $2, last_error = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND state = 'pending'`,
            [rem.id, check.state, check.reason]
          );
          if (check.state === 'suppressed') {
            await outbox.emit(ctx.tx, { name: 'reminder.suppressed', aggregateType: 'reminder', aggregateId: rem.id, payload: { reminderId: rem.id } });
          }
          return;
        }
        await repo.insertDelivery(
          ctx.tx,
          {
            dedupeKey: `notif:rem:${rem.id}:${rem.scheduled_for.getTime()}`,
            eventId: null,
            family: 'business',
            template: reminderTemplate(rem),
            channel: 'in_app',
            recipientId: rem.recipient_id,
            sourceType: check.redactTo?.sourceType ?? rem.source_type,
            sourceId: check.redactTo?.sourceId ?? rem.source_id,
            state: 'sent',
            summary: { leadMinutes: rem.lead_minutes },
          },
          ctx.now
        );
        await repo.recordReminderResult(ctx.tx, rem.id, { state: 'sent', sentAt: ctx.now });
      });
      dispatched++;
    } catch (err) {
      console.error(`[notifications] reminder dispatch error for reminder ${rem.id}: ${errorSummary(err)}`);
      if (rem.attempt_count >= REMINDER_MAX_ATTEMPTS) {
        await runSystemTx('notifications.reminder_dispatch', async (ctx) => {
          const { rowCount } = await ctx.tx.query(
            `UPDATE reminders SET state = 'failed', last_error = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND state = 'pending'`,
            [rem.id, 'dispatch error'.slice(0, 500)]
          );
          if (rowCount) await outbox.emit(ctx.tx, { name: 'reminder.failed', aggregateType: 'reminder', aggregateId: rem.id, payload: { reminderId: rem.id } });
        }).catch(() => undefined);
      }
    }
  }

  return { claimed: claimed.length, dispatched };
}

// ---------------------------------------------------------------------------
// J-13 D18 daily digests (in-app only; no e-mail mapping exists for these templates)
// ---------------------------------------------------------------------------

export interface DigestResult {
  /** No Owner-saved attendance settings version (or no timezone): nothing is sent on assumed values. */
  notConfigured: boolean;
  /** Not a scheduled working day (weekend / company holiday), or outside today's shift. */
  skipped: 'non_working_day' | 'before_shift' | 'after_shift' | null;
  agentDigests: number;
  ownerDigests: number;
}

/**
 * D1 / D18: the schedule the digests run on, only while attendance is configured (attendance's own
 * `missingSettings` gate: an Owner-saved version with timezone, days, start, office IPs and confirmed
 * holidays). Env defaults (assumed Mon–Fri / 09:00) never count ("do not activate using assumed values").
 */
async function configuredSchedule(db: Queryable): Promise<Schedule | null> {
  const { schedule } = await currentSchedule(db);
  return missingSettings(schedule).length === 0 ? schedule : null;
}

/** The scheduled working day before `date` (skips weekends and company holidays); null if none in 31 days. */
function previousWorkingDay(date: string, s: Schedule): string | null {
  for (let i = 1; i <= 31; i++) {
    const d = addDays(date, -i);
    if (!nonWorkingReason(d, s)) return d;
  }
  return null;
}

/**
 * J-13 (every 5 min, idempotent): from company shift start on a scheduled working day —
 *  - each assigned agent gets one in-app digest of their open follow-ups due today (access re-checked);
 *  - each active Owner gets one morning digest: overdue follow-ups (`followUps.overdueMinutes`, the same
 *    "overdue" as the calling queue) and the previous scheduled day's missing-checkout flags (J-04).
 * One row per recipient per company date (dedupe key); nothing is sent when there is nothing to report.
 * A run after the shift has ended (worker down all day) sends nothing for that day.
 */
export async function runDailyDigests(ctx: CommandContext): Promise<DigestResult> {
  const out: DigestResult = { notConfigured: false, skipped: null, agentDigests: 0, ownerDigests: 0 };
  const s = await configuredSchedule(ctx.tx);
  if (!s) {
    out.notConfigured = true;
    return out;
  }
  const now = ctx.now;
  const date = workDateOf(now, s.timezone);
  // Owner decision 2026-10-29: each recipient's own start time / working days decide their digest
  // window (attendance `employeeSchedule`); company holidays apply to everyone. `skipped` reports the
  // company-default window.
  const windowOf = (es: Schedule): DigestResult['skipped'] => {
    if (nonWorkingReason(date, es)) return 'non_working_day';
    const start = zonedToUtc(date, es.shiftStart, es.timezone);
    // D1: shift end = scheduled start + 9 h.
    const end = shiftEndAt(date, es) ?? new Date(start.getTime() + REQUIRED_MINUTES * 60_000);
    if (now.getTime() < start.getTime()) return 'before_shift';
    if (now.getTime() >= end.getTime()) return 'after_shift';
    return null;
  };
  out.skipped = windowOf(s);
  if (s.holidays.includes(date)) return out;
  const inWindow = async (employeeId: string) => windowOf(await employeeSchedule(ctx.tx, employeeId, date)) === null;
  const enabled = await getSetting(ctx.tx, 'notifications.inApp');
  const inApp = (key: string, template: string, recipientId: string, summary: Record<string, unknown>) =>
    repo.insertDelivery(
      ctx.tx,
      {
        dedupeKey: key,
        eventId: null,
        family: 'business',
        template,
        channel: 'in_app',
        recipientId,
        sourceType: 'digest',
        sourceId: date,
        state: enabled ? 'sent' : 'suppressed',
        lastError: enabled ? null : 'in-app notifications are off',
        summary,
      },
      now
    );

  // Follow-up digest: the current assignee of each open follow-up due today (company date).
  const dayStart = zonedToUtc(date, '00:00', s.timezone);
  const dayEnd = zonedToUtc(addDays(date, 1), '00:00', s.timezone);
  const { rows: due } = await ctx.tx.query<{ id: string; responsible_id: string; role: string }>(
    `SELECT f.id, f.responsible_id, e.role
       FROM follow_ups f JOIN employees e ON e.id = f.responsible_id AND e.is_active = true
      WHERE f.state = 'scheduled' AND f.scheduled_for >= $1 AND f.scheduled_for < $2
        AND NOT EXISTS (SELECT 1 FROM notification_deliveries n WHERE n.dedupe_key = 'notif:digest:fup:' || $3 || ':' || f.responsible_id::text)
        -- D1: an Owner-approved day off suppresses the agent's attendance-day notices (read-only, attendance table).
        AND NOT EXISTS (SELECT 1 FROM attendance_days_off o WHERE o.employee_id = f.responsible_id AND o.cancelled_at IS NULL
                          AND $3::date BETWEEN o.start_date AND o.end_date)
      ORDER BY f.responsible_id, f.scheduled_for`,
    [dayStart, dayEnd, date]
  );
  const byAgent = new Map<string, { role: string; ids: string[] }>();
  for (const r of due) {
    const a = byAgent.get(r.responsible_id) ?? { role: r.role, ids: [] };
    a.ids.push(r.id);
    byAgent.set(r.responsible_id, a);
  }
  for (const [agentId, a] of byAgent) {
    if (!(await inWindow(agentId))) continue;
    // C6 / D9: count only the follow-ups the agent may still see now.
    const principal: Principal = { employeeId: agentId, role: a.role as Principal['role'], sessionState: 'active' };
    const decisions = await access.checkMany(ctx.tx, principal, 'follow_up.read', a.ids.map((id) => ({ type: 'follow_up' as const, id })));
    const visible = a.ids.filter((id) => decisions.get(id)?.allowed).length;
    if (visible === 0) continue;
    if (await inApp(`notif:digest:fup:${date}:${agentId}`, 'business.follow_up_digest', agentId, { date, dueToday: visible })) out.agentDigests++;
  }

  // Owner morning digest (one per Owner per company date).
  const ownerIds = await activeByRole(ctx.tx, 'owner');
  if (ownerIds.length === 0) return out;
  const overdueMinutes = await getSetting(ctx.tx, 'followUps.overdueMinutes');
  const { rows: od } = await ctx.tx.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM follow_ups WHERE state = 'scheduled' AND scheduled_for + make_interval(mins => $2::int) < $1`,
    [now, overdueMinutes]
  );
  const prev = previousWorkingDay(date, s);
  let missing = 0;
  if (prev) {
    // Read-only: the missing-checkout flags J-04 (attendance.exception_check) writes to attendance_exceptions.
    const { rows: mc } = await ctx.tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM attendance_exceptions WHERE kind = 'missing_checkout' AND work_date = $1::date`,
      [prev]
    );
    missing = mc[0]?.n ?? 0;
  }
  const overdue = od[0]?.n ?? 0;
  if (overdue === 0 && missing === 0) return out;
  const summary = { date, overdueFollowUps: overdue, missingCheckouts: missing, missingCheckoutDate: prev };
  for (const ownerId of ownerIds) {
    if (!(await inWindow(ownerId))) continue;
    if (await inApp(`notif:digest:owner:${date}:${ownerId}`, 'business.owner_digest', ownerId, summary)) out.ownerDigests++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// J-02 delivery dispatch (email)
// ---------------------------------------------------------------------------

export const DISPATCH = { batchSize: 25, leaseSeconds: 120 } as const;

type Built =
  | { kind: 'send'; message: EmailMessage; secretRef: string | null }
  | { kind: 'stop'; state: 'suppressed' | 'skipped' | 'failed'; reason: string; secretRef: string | null };

/** Build content at SEND time from the current state (C6/HR-7). */
async function buildEmail(db: Queryable, d: repo.DeliveryRow, now: Date): Promise<Built> {
  const secretRef = d.source_type === 'security_token' ? d.source_id : null;
  const contact = await repo.recipientContact(db, d.recipient_id);
  if (!contact || !contact.isActive) return { kind: 'stop', state: 'suppressed', reason: 'recipient inactive', secretRef };

  if (d.template === 'security.password_reset' || d.template === 'security.credential_setup') {
    if (!secretRef) return { kind: 'stop', state: 'failed', reason: 'missing source', secretRef };
    const cipher = await repo.getSecret(db, secretRef, now);
    if (!cipher) return { kind: 'stop', state: 'skipped', reason: 'link expired or already used', secretRef };
    const raw = decryptSecret(cipher, secretRef);
    if (!raw) return { kind: 'stop', state: 'failed', reason: 'secret unreadable', secretRef };

    if (d.template === 'security.credential_setup') {
      return {
        kind: 'send',
        secretRef,
        message: {
          to: contact.email,
          template: 'security.credential_setup',
          idempotencyKey: d.id,
          vars: {
            name: contact.fullName,
            setupUrl: `${config.publicAppUrl}/reset-password?token=${encodeURIComponent(raw)}`,
          },
        },
      };
    }

    return {
      kind: 'send',
      secretRef,
      message: {
        to: contact.email,
        template: 'security.password_reset',
        idempotencyKey: d.id,
        vars: {
          name: contact.fullName,
          resetUrl: `${config.publicAppUrl}/reset-password?token=${encodeURIComponent(raw)}`,
          ttlMinutes: String(config.password.resetTtlMinutes),
        },
      },
    };
  }

  return { kind: 'stop', state: 'failed', reason: 'no content builder for template', secretRef };
}

async function emitDeliveryOutcome(
  tx: Queryable,
  deliveryId: string,
  template: string,
  state: 'failed' | 'suppressed',
  family: 'security' | 'business'
): Promise<void> {
  if (template === ('business.delivery_failure' satisfies EmailTemplateId)) return;
  await outbox.emit(tx, {
    name: state === 'failed' ? 'notification.failed' : 'notification.suppressed',
    aggregateType: 'notification_delivery',
    aggregateId: deliveryId,
    payload: { deliveryId, family },
  });
}

async function finish(
  d: repo.DeliveryRow,
  r: { state: repo.DeliveryState; error?: string | null; nextAttemptAt?: Date; providerMessageId?: string | null; sentAt?: Date | null },
  secretRef: string | null
): Promise<void> {
  await runSystemTx('notifications.delivery_dispatch', async (ctx) => {
    await repo.recordDeliveryResult(ctx.tx, d.id, r);
    const terminal = r.state !== 'pending' && r.state !== 'retry_pending';
    if (terminal && secretRef) await repo.consumeSecret(ctx.tx, secretRef, ctx.now);
    if (r.state === 'failed' || r.state === 'suppressed') {
      await emitDeliveryOutcome(ctx.tx, d.id, d.template, r.state, d.family);
    }
  });
}

export interface DispatchResult {
  claimed: number;
  /** SMTP provider accepted the message (250). Not confirmed delivery. */
  accepted: number;
  /** Taken by a log / memory transport: nothing left this machine. */
  captured: number;
  retry: number;
  failed: number;
  suppressed: number;
  skipped: number;
}

/** Retry delays: `notifications.emailRetrySeconds` (Demonstration alternative — not approved). */
async function retrySchedule(): Promise<number[]> {
  try {
    const v = await getSetting(pool, 'notifications.emailRetrySeconds');
    return Array.isArray(v) && v.length > 0 ? v : [60, 600, 3600];
  } catch {
    return [60, 600, 3600];
  }
}

export async function dispatchDueDeliveries(): Promise<DispatchResult> {
  const out: DispatchResult = { claimed: 0, accepted: 0, captured: 0, retry: 0, failed: 0, suppressed: 0, skipped: 0 };
  const claimed = await repo.claimDueEmailDeliveries(pool, clock.now(), DISPATCH.leaseSeconds, DISPATCH.batchSize);
  out.claimed = claimed.length;
  if (claimed.length === 0) return out;
  const retries = await retrySchedule();
  const transport = getEmailTransport();
  // smtp success = accepted by the provider; log / memory success = captured (never delivered).
  // D18 delivery states: queued (pending / retry_pending), provider-accepted, failed, test-captured. "Delivered"
  // is NOT recorded for e-mail: it cannot be confirmed without provider delivery webhooks, which v1 does not
  // have. In-app rows are `sent` (delivered by being written).
  const okState: repo.DeliveryState = transport.kind === 'smtp' ? 'accepted' : 'captured';

  for (const d of claimed) {
    try {
      if (transport.kind === 'none') {
        // FX-MAIL: production without a real sender. Nothing is built or decrypted; the row is an Owner
        // failure on the Delivery monitor (notification.failed). The secret is kept, so "Send again"
        // works once SMTP is configured, while the link is still valid.
        await finish(d, { state: 'failed', error: EMAIL_NOT_CONFIGURED }, null);
        out.failed++;
        continue;
      }
      const built = await buildEmail(pool, d, clock.now());
      if (built.kind === 'stop') {
        await finish(d, { state: built.state, error: built.reason }, built.secretRef);
        out[built.state]++;
        continue;
      }
      const res = await transport.send(built.message);
      const now = clock.now();
      if (res.ok) {
        // sent_at records the provider hand-off only; a captured message was never handed to anyone.
        await finish(
          d,
          { state: okState, sentAt: okState === 'accepted' ? now : null, providerMessageId: res.providerMessageId ?? null, error: null },
          built.secretRef
        );
        out[okState === 'accepted' ? 'accepted' : 'captured']++;
      } else if (!res.permanent && d.attempt_count <= retries.length) {
        const delay = retries[d.attempt_count - 1];
        await finish(d, { state: 'retry_pending', error: res.error, nextAttemptAt: new Date(now.getTime() + delay * 1000) }, null);
        out.retry++;
      } else {
        await finish(d, { state: 'failed', error: res.error }, built.secretRef);
        out.failed++;
      }
    } catch (err) {
      console.error(`[notifications] dispatch error for delivery ${d.id}: ${errorSummary(err)}`);
    }
  }
  return out;
}
