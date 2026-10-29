/**
 * MOD-notifications D18 v1 policy (docs/policy-baseline-2026-10-29.md §D18) — DB tests (TEST_DATABASE_URL only):
 * shift-start digests (working day / holiday / weekend / not configured), follow-up overdue alert once,
 * Owner morning digest dedupe + previous-day missing checkouts, data-correction recipients, delivery-failure
 * dedupe, and meeting reminders to the deal's Developer + the business's Call Center agent.
 * Time comes from the test clock; dates are far in the future so other files' rows do not collide.
 */
import crypto from 'crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { pool, query, withTransaction } from '../../db/pool.js';
import { outbox, type OutboxEventName, type OutboxPayload } from '../../shared/outbox.js';
import { access } from '../../shared/access.js';
import { runSystemCommand } from '../../shared/tx.js';
import { initCallingState } from '../calls/service.js';
import { createAcceptedOpportunity } from '../deals/service.js';
import { clock } from '../platform/clock.js';
import { relayOutboxOnce, runSystemTx } from '../platform/service.js';
import { dispatchDueReminders, listMyNotifications, runDailyDigests } from './service.js';

void app; // registers every module (outbox writer, consumers, jobs)
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

async function relayAll(): Promise<void> {
  for (let i = 0; i < 100; i++) if ((await relayOutboxOnce()).claimed === 0) return;
}
async function remindAll(): Promise<void> {
  for (let i = 0; i < 100; i++) if ((await dispatchDueReminders()).claimed === 0) return;
}

async function emp(role: string, isActive = true): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'D18 Test', $2, $3) RETURNING id`,
    [`d18.${uniq()}@test.local`, role, isActive]
  );
  return rows[0].id;
}

async function business(createdBy: string, assignee?: string): Promise<string> {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [`D18 Biz ${uniq()}`, createdBy]);
    await initCallingState(tx, rows[0].id);
    // D9: the agent's 15-day window starts at assignment (test-clock time).
    if (assignee) await tx.query(`INSERT INTO calling_assignments (business_id, assignee_id, started_at) VALUES ($1, $2, $3)`, [rows[0].id, assignee, clock.now()]);
    return rows[0].id;
  });
}

async function followUp(businessId: string, responsible: string, at: Date): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO follow_ups (business_id, responsible_id, scheduled_for, created_by) VALUES ($1, $2, $3, $2) RETURNING id`,
    [businessId, responsible, at]
  );
  return rows[0].id;
}

async function emit(name: OutboxEventName, aggregateType: string, aggregateId: string, payload: OutboxPayload = {}): Promise<string> {
  const id = await withTransaction((tx) => outbox.emit(tx, { name, aggregateType, aggregateId, payload }));
  await relayAll();
  return id;
}

const versionIds: string[] = [];
/** Owner-saved attendance settings: Mon–Fri 09:00 Asia/Beirut, holidays confirmed (configured). */
async function saveSchedule(owner: string, opts: { holidays?: string[]; confirmed?: boolean } = {}): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO attendance_settings_versions (version_no, timezone, working_days, shift_start, shift_end, grace_minutes,
       verification_mode, office_ips, holidays, holidays_confirmed, summary_required, summary_min_length, missing_checkout_flag_hours, reason, created_by)
     VALUES (COALESCE((SELECT MAX(version_no) + 1 FROM attendance_settings_versions), 1), 'Asia/Beirut',
       ARRAY['MON','TUE','WED','THU','FRI'], '09:00', '18:00', 10, 'ip', ARRAY['127.0.0.1'], $2::date[], $3, true, 10, 6, 'D18 test', $1)
     RETURNING id`,
    [owner, opts.holidays ?? [], opts.confirmed ?? true]
  );
  versionIds.push(rows[0].id);
}

const digest = () => runSystemTx('test.d18_digest', (ctx) => runDailyDigests(ctx));
const deliveries = (template: string, recipientId: string) =>
  query<{ id: string; summary: Record<string, unknown> | null; source_id: string | null; read_at: Date | null }>(
    `SELECT id, summary, source_id, read_at FROM notification_deliveries WHERE template = $1 AND recipient_id = $2 ORDER BY created_at`,
    [template, recipientId]
  ).then((r) => r.rows);

/** Deliveries produced by one outbox event (the shared Owner accumulates rows across runs on a reused DB). */
const eventDeliveries = (eventId: string, template: string, recipientId: string) =>
  query<{ id: string }>(`SELECT id FROM notification_deliveries WHERE event_id = $1 AND template = $2 AND recipient_id = $3`, [eventId, template, recipientId]).then(
    (r) => r.rows
  );

/** Beirut is UTC+2 in early March 2027 (DST starts 28 March). 2027-03-01 is a Monday. */
const beirut = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+02:00`);

// Relaying drains every due event of the shared test DB (other files' backlog), so allow more than 5 s.
describe.skipIf(!hasTestDb)('D18 notifications v1 policy (DB)', { timeout: 60_000 }, () => {
  let owner: string;
  let otherOwners: string[];

  beforeAll(async () => {
    owner = await emp('owner');
    const { rows } = await query<{ id: string }>(`SELECT id FROM employees WHERE role = 'owner' AND is_active = true AND id <> $1`, [owner]);
    otherOwners = rows.map((r) => r.id);
  });
  afterEach(() => clock.set(null));
  afterAll(async () => {
    if (versionIds.length) await query('DELETE FROM attendance_settings_versions WHERE id = ANY($1::uuid[])', [versionIds]);
    // Throwaway test DB only: rows written at the far-future test clock would otherwise sort above every
    // later file's rows (delivery monitor / inbox are newest-first).
    await query(`DELETE FROM notification_deliveries WHERE created_at > now() + interval '30 days'`);
    await query(`DELETE FROM reminders WHERE scheduled_for > now() + interval '30 days'`);
    await pool.end();
  });

  it('follow-up digest: assigned agent at shift start on a working day, once; not before shift start', async () => {
    await saveSchedule(owner);
    const agent = await emp('call_center');
    const day = '2027-03-01'; // Monday
    await followUp(await business(owner, agent), agent, beirut(day, '11:00'));
    await followUp(await business(owner, agent), agent, beirut(day, '16:30'));
    await followUp(await business(owner, agent), agent, beirut('2027-03-02', '10:00')); // tomorrow: not in today's digest

    clock.set(beirut(day, '08:55'));
    expect((await digest()).skipped).toBe('before_shift');
    expect(await deliveries('business.follow_up_digest', agent)).toHaveLength(0);

    clock.set(beirut(day, '09:02'));
    const r = await digest();
    expect(r).toMatchObject({ notConfigured: false, skipped: null });
    clock.set(beirut(day, '09:07'));
    await digest(); // the next 5-min slot does not repeat it
    const rows = await deliveries('business.follow_up_digest', agent);
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toEqual({ date: day, dueToday: 2 });
    const { rows: ch } = await query(`SELECT channel, state FROM notification_deliveries WHERE id = $1`, [rows[0].id]);
    expect(ch[0]).toEqual({ channel: 'in_app', state: 'sent' }); // no e-mail for digests
    const inbox = await listMyNotifications(pool, { employeeId: agent, role: 'call_center', sessionState: 'active' });
    expect(inbox.items.find((i) => i.id === rows[0].id)).toMatchObject({ title: "Today's Follow-ups", message: 'You have 2 follow-up calls due today.' });
  });

  it('follow-up digest: nothing on a company holiday or a weekend', async () => {
    await saveSchedule(owner, { holidays: ['2027-03-03'] });
    const agent = await emp('call_center');
    await followUp(await business(owner, agent), agent, beirut('2027-03-03', '12:00'));
    clock.set(beirut('2027-03-03', '09:30')); // Wednesday holiday
    expect((await digest()).skipped).toBe('non_working_day');
    await followUp(await business(owner, agent), agent, beirut('2027-03-06', '12:00'));
    clock.set(beirut('2027-03-06', '09:30')); // Saturday
    expect((await digest()).skipped).toBe('non_working_day');
    expect(await deliveries('business.follow_up_digest', agent)).toHaveLength(0);
  });

  it('digests do not run while attendance is not configured (no assumed Mon–Fri / 09:00)', async () => {
    await saveSchedule(owner, { confirmed: false }); // latest version: holidays not confirmed → not configured
    const agent = await emp('call_center');
    await followUp(await business(owner, agent), agent, beirut('2027-03-04', '12:00'));
    clock.set(beirut('2027-03-04', '09:30')); // Thursday
    expect(await digest()).toMatchObject({ notConfigured: true, agentDigests: 0, ownerDigests: 0 });
    expect(await deliveries('business.follow_up_digest', agent)).toHaveLength(0);
    expect((await deliveries('business.owner_digest', owner)).filter((d) => d.summary?.date === '2027-03-04')).toHaveLength(0);
  });

  it('Owner morning digest: one per Owner per day, with overdue follow-ups and the previous working day missing checkouts', async () => {
    await saveSchedule(owner);
    const agent = await emp('call_center');
    const worker = await emp('developer');
    // Monday 2027-03-08: the previous scheduled working day is Friday 2027-03-05.
    await query(`INSERT INTO attendance_exceptions (kind, work_date, employee_id) VALUES ('missing_checkout', '2027-03-05', $1)`, [worker]);
    await followUp(await business(owner, agent), agent, beirut('2027-03-08', '07:00')); // overdue at 09:05 (> 60 min)
    clock.set(beirut('2027-03-08', '09:05'));
    await digest();
    clock.set(beirut('2027-03-08', '09:10'));
    await digest();
    const onDay = async (id: string) => (await deliveries('business.owner_digest', id)).filter((d) => d.summary?.date === '2027-03-08');
    const rows = await onDay(owner);
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toMatchObject({ date: '2027-03-08', missingCheckoutDate: '2027-03-05' });
    expect(rows[0].summary?.missingCheckouts).toBeGreaterThanOrEqual(1);
    expect(rows[0].summary?.overdueFollowUps).toBeGreaterThanOrEqual(1);
    for (const o of otherOwners) expect(await onDay(o)).toHaveLength(1);
    const inbox = await listMyNotifications(pool, { employeeId: owner, role: 'owner', sessionState: 'active' });
    expect(inbox.items.find((i) => i.id === rows[0].id)?.message).toMatch(/^Waiting for review: \d+ overdue follow-ups? and \d+ missing checkouts? from the previous working day\.$/);
  });

  it('missing checkout: one employee reminder at shift end + 1 h; the + 6 h flag notifies nobody (Owner digest instead)', async () => {
    const worker = await emp('developer');
    const sessionId = crypto.randomUUID();
    await emit('attendance.missing_checkout_reminder', 'attendance_session', sessionId, { employeeId: worker, sessionId, workDate: '2027-03-05' });
    expect(await deliveries('business.attendance_alert', worker)).toHaveLength(1);
    await emit('attendance.missing_checkout_detected', 'attendance_session', sessionId, { employeeId: worker, sessionId, workDate: '2027-03-05' });
    expect(await deliveries('business.attendance_alert', worker)).toHaveLength(1);
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM notification_deliveries d JOIN outbox_events e ON e.id = d.event_id
        WHERE e.payload->>'employeeId' = $1 AND d.recipient_id = $2`,
      [worker, owner]
    );
    expect(rows[0].n).toBe(0);
  });

  it('follow-up due 15 min before and overdue 1 h after go to the current assignee; overdue is sent once', async () => {
    const t0 = beirut('2027-04-01', '10:00');
    clock.set(new Date(t0.getTime() - 3 * 3600_000));
    const agent = await emp('call_center');
    const agent2 = await emp('call_center');
    const biz = await business(owner, agent);
    const fup = await followUp(biz, agent, t0);
    await emit('follow_up.scheduled', 'follow_up', fup, { businessId: biz });
    const { rows: rems } = await query<{ lead_minutes: number; scheduled_for: Date; recipient_id: string }>(
      `SELECT lead_minutes, scheduled_for, recipient_id FROM reminders WHERE source_id = $1 AND state = 'pending' ORDER BY lead_minutes`,
      [fup]
    );
    expect(rems.map((r) => [r.lead_minutes, r.scheduled_for.getTime() - t0.getTime(), r.recipient_id])).toEqual([
      [-60, 60 * 60_000, agent],
      [15, -15 * 60_000, agent],
    ]);

    clock.set(new Date(t0.getTime() - 14 * 60_000));
    await remindAll();
    expect(await deliveries('business.follow_up_reminder', agent)).toHaveLength(1);

    clock.set(new Date(t0.getTime() + 59 * 60_000));
    await remindAll();
    expect(await deliveries('business.follow_up_overdue', agent)).toHaveLength(0);
    clock.set(new Date(t0.getTime() + 61 * 60_000));
    await remindAll();
    await remindAll();
    expect(await deliveries('business.follow_up_overdue', agent)).toHaveLength(1);

    // Reassigned after the alert: the alert is not sent again (once per follow-up due time).
    await query(`UPDATE calling_assignments SET ended_at = now(), end_reason = 'reassigned' WHERE business_id = $1 AND ended_at IS NULL`, [biz]);
    await query(`INSERT INTO calling_assignments (business_id, assignee_id) VALUES ($1, $2)`, [biz, agent2]);
    await query(`UPDATE follow_ups SET responsible_id = $2 WHERE id = $1`, [fup, agent2]);
    await emit('follow_up.reassigned', 'follow_up', fup, { businessId: biz });
    clock.set(new Date(t0.getTime() + 70 * 60_000));
    await remindAll();
    expect(await deliveries('business.follow_up_overdue', agent2)).toHaveLength(0);
    expect(await deliveries('business.follow_up_overdue', agent)).toHaveLength(1);
  });

  it('overdue alert is cancelled when the follow-up is completed first', async () => {
    const t0 = beirut('2027-04-02', '10:00');
    clock.set(new Date(t0.getTime() - 3600_000));
    const agent = await emp('call_center');
    const biz = await business(owner, agent);
    const fup = await followUp(biz, agent, t0);
    await emit('follow_up.scheduled', 'follow_up', fup, { businessId: biz });
    await query(`UPDATE follow_ups SET state = 'completed', completed_at = $2 WHERE id = $1`, [fup, t0]);
    await emit('follow_up.completed', 'follow_up', fup, { businessId: biz });
    clock.set(new Date(t0.getTime() + 2 * 3600_000));
    await remindAll();
    expect(await deliveries('business.follow_up_overdue', agent)).toHaveLength(0);
  });

  it('data correction request: the business creator (Data Entry) and every Owner; not the requester; not an inactive creator', async () => {
    const de = await emp('data_entry');
    const cc = await emp('call_center');
    const otherDe = await emp('data_entry');
    const biz = await business(de, cc);
    const { rows } = await query<{ id: string }>(
      `INSERT INTO data_correction_requests (business_id, requested_by, issue_type, description) VALUES ($1, $2, 'wrong_phone', 'Phone is wrong') RETURNING id`,
      [biz, cc]
    );
    const ev1 = await emit('data_correction_request.submitted', 'data_correction_request', rows[0].id, { businessId: biz });
    expect(await deliveries('business.correction_request', de)).toHaveLength(1);
    expect(await eventDeliveries(ev1, 'business.correction_request', owner)).toHaveLength(1);
    expect(await deliveries('business.correction_request', otherDe)).toHaveLength(0);
    expect(await deliveries('business.correction_request', cc)).toHaveLength(0);

    const de2 = await emp('data_entry');
    const biz2 = await business(de2, cc);
    await query('UPDATE employees SET is_active = false WHERE id = $1', [de2]);
    const { rows: r2 } = await query<{ id: string }>(
      `INSERT INTO data_correction_requests (business_id, requested_by, issue_type, description) VALUES ($1, $2, 'wrong_phone', 'Phone is wrong') RETURNING id`,
      [biz2, cc]
    );
    const ev2 = await emit('data_correction_request.submitted', 'data_correction_request', r2[0].id, { businessId: biz2 });
    expect(await deliveries('business.correction_request', de2)).toHaveLength(0);
    expect(await eventDeliveries(ev2, 'business.correction_request', owner)).toHaveLength(1);
  });

  it('delivery failure: one open Owner alert per failure group; repeats bump the count; a read alert starts a new one', async () => {
    clock.set(new Date('2027-05-01T08:00:00Z'));
    const template = `business.test_failure_${uniq()}`;
    const failed = async (tpl: string) => {
      const target = await emp('developer');
      const { rows } = await query<{ id: string }>(
        `INSERT INTO notification_deliveries (dedupe_key, family, template, channel, recipient_id, state)
         VALUES ($1, 'business', $2, 'email', $3, 'failed') RETURNING id`,
        [`d18-fail-${uniq()}`, tpl, target]
      );
      await emit('notification.failed', 'notification_delivery', rows[0].id, { deliveryId: rows[0].id, family: 'business' });
      return rows[0].id;
    };
    const mine = async (tpl: string) => (await deliveries('business.delivery_failure', owner)).filter((d) => d.summary?.group === `delivery:${tpl}`);

    await failed(template);
    await failed(template);
    const last = await failed(template);
    let alerts = await mine(template);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].summary).toEqual({ group: `delivery:${template}`, count: 3 });
    expect(alerts[0].source_id).toBe(last); // points at the latest failure
    const inbox = await listMyNotifications(pool, { employeeId: owner, role: 'owner', sessionState: 'active' });
    expect(inbox.items.find((i) => i.id === alerts[0].id)?.message).toBe('3 notifications or reminders of the same kind could not be delivered.');

    const other = `${template}_b`;
    await failed(other);
    expect(await mine(other)).toHaveLength(1);

    await query(`UPDATE notification_deliveries SET read_at = now() WHERE id = $1`, [alerts[0].id]);
    clock.set(new Date('2027-05-01T08:05:00Z')); // distinct created_at so the order is stable
    await failed(template);
    alerts = await mine(template);
    expect(alerts).toHaveLength(2);
    expect(alerts[1].summary).toEqual({ group: `delivery:${template}`, count: 1 });

    // Older than the 24 h window: a new alert even while unread.
    clock.set(new Date('2027-05-02T09:00:00Z'));
    await failed(other);
    expect(await mine(other)).toHaveLength(2);
  });

  it('meeting reminders 24 h and 1 h before go to the deal Developer and the business Call Center agent', async () => {
    const start = new Date('2027-06-10T10:00:00Z');
    clock.set(new Date(start.getTime() - 3 * 24 * 3600_000));
    const agent = await emp('call_center');
    const dev = await emp('developer');
    const dev2 = await emp('developer');
    const biz = await business(owner, agent);
    const { rows: a } = await query<{ id: string }>(
      `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1, $2, 'accepted', $3) RETURNING id`,
      [biz, agent, crypto.randomUUID()]
    );
    const { dealId } = await runSystemCommand('test.accept', (ctx) =>
      createAcceptedOpportunity(ctx, { businessId: biz, callAttemptId: a[0].id, acceptingAgentId: agent, clientNeedsNote: 'Needs a booking portal', developerId: dev })
    );
    await relayAll();
    const { rows: m } = await query<{ id: string }>(
      `INSERT INTO meetings (deal_id, business_id, starts_at, created_by_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [dealId, biz, start, owner]
    );
    await query(`INSERT INTO meeting_attendees (meeting_id, employee_id) VALUES ($1, $2)`, [m[0].id, owner]);
    await emit('meeting.scheduled', 'meeting', m[0].id, { dealId });
    const planned = async () =>
      (
        await query<{ recipient_id: string; lead_minutes: number }>(
          `SELECT recipient_id, lead_minutes FROM reminders WHERE source_type = 'meeting' AND source_id = $1 AND state = 'pending'`,
          [m[0].id]
        )
      ).rows;
    const leadsFor = async (id: string) => (await planned()).filter((r) => r.recipient_id === id).map((r) => r.lead_minutes).sort((x, y) => x - y);
    expect(await leadsFor(dev)).toEqual([60, 1440]);
    expect(await leadsFor(agent)).toEqual([60, 1440]);
    expect(await leadsFor(owner)).toEqual([60, 1440]); // a current attendee keeps the reminder

    // Developer handed off: the new Developer is planned, the previous one cancelled.
    await query(`UPDATE deals SET assigned_developer_id = $2 WHERE id = $1`, [dealId, dev2]);
    await emit('opportunity.developer_reassigned', 'deal', dealId, { dealId, developerId: dev2, previousDeveloperId: dev });
    expect(await leadsFor(dev2)).toEqual([60, 1440]);
    expect(await leadsFor(dev)).toEqual([]);

    clock.set(new Date(start.getTime() - 24 * 3600_000 + 60_000));
    await remindAll();
    const toDev = await deliveries('business.meeting_reminder', dev2);
    expect(toDev).toHaveLength(1);
    expect(toDev[0]).toMatchObject({ source_id: m[0].id, summary: { leadMinutes: 1440 } });
    expect(await deliveries('business.meeting_reminder', dev)).toHaveLength(0);
    // The Call Center agent is reminded too. When the access engine denies them the meeting (D15) but allows
    // the business, the notice is redacted to the business; otherwise it points at the meeting.
    const toAgent = await deliveries('business.meeting_reminder', agent);
    expect(toAgent).toHaveLength(1);
    const ccPrincipal = { employeeId: agent, role: 'call_center', sessionState: 'active' } as const;
    const seesMeeting = (await access.check(pool, ccPrincipal, 'meeting.read', { type: 'meeting', id: m[0].id })).allowed;
    expect(toAgent[0].source_id).toBe(seesMeeting ? m[0].id : biz);
    const inbox = await listMyNotifications(pool, ccPrincipal);
    expect(inbox.items.find((i) => i.id === toAgent[0].id)?.message).toBe(
      seesMeeting ? 'An upcoming commercial discovery meeting starts in 24 hours.' : 'A client meeting for one of your assigned businesses starts in 24 hours.'
    );
    const devInbox = await listMyNotifications(pool, { employeeId: dev2, role: 'developer', sessionState: 'active' });
    expect(devInbox.items.find((i) => i.id === toDev[0].id)?.message).toBe('An upcoming commercial discovery meeting starts in 24 hours.');
  });
});
