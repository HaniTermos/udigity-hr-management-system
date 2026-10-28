/**
 * MOD-notifications DB tests (TEST_DATABASE_URL only). E-03 path end-to-end through the outbox,
 * J-03 relay and J-02 dispatch into the memory mail sink (no network, no real email), plus email
 * retry/backoff, permanent failure, inactive-recipient suppression and the EM-7 per-account limit.
 */
import crypto from 'crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { storeEnrolledSecret } from '../identity/twoFactor.js';
import type { EmailMessage, EmailSendResult, EmailTransport } from '../../shared/outbox.js';
import { clock } from '../platform/clock.js';
import { relayOutboxOnce } from '../platform/service.js';
import { dispatchDueDeliveries, queuePasswordResetEmail, RESET_EMAILS_PER_HOUR } from './service.js';
import { EMAIL_NOT_CONFIGURED } from './emailConfig.js';
import { getEmailTransport, mailSink, setEmailTransport, UnconfiguredEmailTransport } from './transport.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

class ScriptedTransport implements EmailTransport {
  readonly kind = 'memory' as const;
  sent: EmailMessage[] = [];
  /** Only messages to `onlyTo` follow the script; other rows left in the shared test DB succeed. */
  constructor(private readonly script: EmailSendResult[], private readonly onlyTo: string) {}
  async send(m: EmailMessage): Promise<EmailSendResult> {
    if (m.to !== this.onlyTo) return { ok: true, providerMessageId: 'other' };
    this.sent.push(m);
    return this.script.shift() ?? { ok: true, providerMessageId: 'x' };
  }
}

/** Stands in for nodemailer SMTP: kind `smtp`, answers like a provider 250 (no network). */
class AcceptingSmtpStub implements EmailTransport {
  readonly kind = 'smtp' as const;
  async send(m: EmailMessage): Promise<EmailSendResult> {
    return { ok: true, providerMessageId: `<${m.idempotencyKey}@provider.test>` };
  }
}

/** Fresh Owner with completed 2FA; returns the session cookie. */
async function ownerCookie(): Promise<string> {
  const ownerEmail = `owner.monitor.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'Owner Monitor', 'owner', true) RETURNING id`,
    [ownerEmail]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash('Password123!', 4)]);
  await withTransaction((tx) => storeEnrolledSecret(tx, rows[0].id, DEV_TOTP_SECRET));
  const s = await request(app).post('/api/auth/login').set('Origin', 'http://localhost:3000').send({ email: ownerEmail, password: 'Password123!' });
  const sCookie = ([] as string[]).concat(s.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`))?.split(';')[0] ?? '';
  const v = await request(app)
    .post('/api/auth/2fa/verify')
    .set('Cookie', sCookie)
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', s.body.csrfToken)
    .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
  return ([] as string[]).concat(v.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`))?.split(';')[0] ?? '';
}

async function employee(isActive = true): Promise<{ id: string; email: string }> {
  const email = `notif.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'Notif <b>Test</b>', 'developer', $2) RETURNING id`,
    [email, isActive]
  );
  return { id: rows[0].id, email };
}

/** What identity's reset request does (BE1 swaps emailStub for this call; REQUEST on the board). */
async function requestReset(employeeId: string, ttlMinutes = 60): Promise<{ tokenId: string; raw: string; eventId: string }> {
  return withTransaction(async (tx) => {
    const raw = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(clock.now().getTime() + ttlMinutes * 60_000);
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO security_tokens (employee_id, purpose, token_hash, expires_at) VALUES ($1, 'password_reset', $2, $3) RETURNING id`,
      [employeeId, crypto.createHash('sha256').update(raw).digest('hex'), expiresAt]
    );
    const eventId = await queuePasswordResetEmail(tx, { employeeId, securityTokenId: rows[0].id, rawToken: raw, expiresAt });
    return { tokenId: rows[0].id, raw, eventId };
  });
}

/**
 * Relay until no due event is left (V-02). One pass claims the 50 OLDEST due events, so with a
 * backlog from earlier files in the shared test DB this test's own event could be left unclaimed.
 */
async function relayAll(): Promise<void> {
  for (let i = 0; i < 100; i++) if ((await relayOutboxOnce()).claimed === 0) return;
}

async function delivery(tokenId: string) {
  const { rows } = await query(`SELECT * FROM notification_deliveries WHERE dedupe_key = $1`, [`e03:${tokenId}`]);
  return rows[0];
}

afterAll(async () => {
  if (hasTestDb) await pool.end();
});

describe.skipIf(!hasTestDb)('E-03 security email via outbox (replaces emailStub)', () => {
  beforeEach(() => {
    setEmailTransport(null);
    mailSink.clear();
  });
  afterEach(() => {
    clock.set(null);
    setEmailTransport(null);
  });

  it('round-trip: token tx → outbox → relay → delivery → J-02 → mail sink; secret never in outbox', async () => {
    expect(getEmailTransport().kind).toBe('memory');
    const emp = await employee();
    const { tokenId, raw, eventId } = await requestReset(emp.id);

    const ev = await query('SELECT payload::text AS p FROM outbox_events WHERE id = $1', [eventId]);
    expect(ev.rows[0].p).not.toContain(raw);
    expect(JSON.parse(ev.rows[0].p)).toEqual({ securityTokenId: tokenId });
    const secret = await query('SELECT ciphertext FROM notification_secrets WHERE ref_id = $1', [tokenId]);
    expect(secret.rows[0].ciphertext).not.toContain(raw);

    await relayAll();
    const d = await delivery(tokenId);
    expect(d).toMatchObject({ family: 'security', channel: 'email', state: 'pending', recipient_id: emp.id });
    // Relaying again does not create a second delivery.
    await relayAll();
    expect((await query('SELECT count(*)::int AS n FROM notification_deliveries WHERE dedupe_key = $1', [`e03:${tokenId}`])).rows[0].n).toBe(1);

    await dispatchDueDeliveries();
    const sent = mailSink.messages().filter((m) => m.to === emp.email);
    expect(sent).toHaveLength(1);
    expect(sent[0].template).toBe('security.password_reset');
    const link = /https?:\/\/\S+/.exec(sent[0].text)?.[0] ?? '';
    expect(new URL(link).searchParams.get('token')).toBe(raw);
    expect(new URL(link).pathname).toBe('/reset-password');
    expect(sent[0].html).toContain('Notif &lt;b&gt;Test&lt;/b&gt;');
    expect(sent[0].messageId).toContain(d.id);

    // FX-MAIL: the memory sink only captured it; nothing claims delivery or a provider hand-off.
    const after = await delivery(tokenId);
    expect(after.state).toBe('captured');
    expect(after.sent_at).toBeNull();
    const consumed = await query('SELECT ciphertext, consumed_at FROM notification_secrets WHERE ref_id = $1', [tokenId]);
    expect(consumed.rows[0].ciphertext).toBeNull();
    expect(consumed.rows[0].consumed_at).not.toBeNull();

    // Already sent: dispatch again does not resend.
    await dispatchDueDeliveries();
    expect(mailSink.messages().filter((m) => m.to === emp.email)).toHaveLength(1);
  });

  it('FX-MAIL: an SMTP 250 is recorded as accepted by the provider (not delivered)', async () => {
    const emp = await employee();
    const { tokenId } = await requestReset(emp.id);
    await relayAll();
    setEmailTransport(new AcceptingSmtpStub());
    const out = await dispatchDueDeliveries();
    expect(out.accepted).toBeGreaterThanOrEqual(1);
    const d = await delivery(tokenId);
    expect(d).toMatchObject({ state: 'accepted', provider_message_id: `<${d.id}@provider.test>`, last_error: null });
    expect(d.sent_at).not.toBeNull();
  });

  it('FX-MAIL: production without a real sender → failed "email transport not configured" on the Delivery monitor', async () => {
    const emp = await employee();
    const { tokenId } = await requestReset(emp.id);
    await relayAll();
    setEmailTransport(new UnconfiguredEmailTransport());
    const out = await dispatchDueDeliveries();
    expect(out.accepted + out.captured).toBe(0);
    const d = await delivery(tokenId);
    expect(d).toMatchObject({ state: 'failed', last_error: EMAIL_NOT_CONFIGURED, sent_at: null, provider_message_id: null });
    expect(mailSink.messages().filter((m) => m.to === emp.email)).toHaveLength(0);
    // E-17: an Owner failure item; the secret is kept so "Send again" works once SMTP is configured.
    const ev = await query(`SELECT name FROM outbox_events WHERE aggregate_id = $1`, [d.id]);
    expect(ev.rows.map((r) => r.name)).toEqual(['notification.failed']);
    const secret = await query('SELECT ciphertext FROM notification_secrets WHERE ref_id = $1', [tokenId]);
    expect(secret.rows[0].ciphertext).not.toBeNull();

    const monitor = await request(app).get('/api/delivery-monitor').query({ kind: 'notification', pageSize: 100 }).set('Cookie', await ownerCookie());
    expect(monitor.status).toBe(200);
    const item = (monitor.body.items as { id: string }[]).find((i) => i.id === d.id);
    expect(item).toMatchObject({ state: 'failed', lastError: EMAIL_NOT_CONFIGURED, sentAt: null, templateOrSource: 'security.password_reset' });

    // Once SMTP is configured, the re-queued row is accepted with the original (still valid) link.
    await query(`UPDATE notification_deliveries SET state = 'pending', next_attempt_at = now(), attempt_count = 0, last_error = NULL WHERE id = $1`, [d.id]);
    setEmailTransport(new AcceptingSmtpStub());
    await dispatchDueDeliveries();
    expect((await delivery(tokenId)).state).toBe('accepted');
  });

  it('inactive recipient → suppressed, no email, notification.suppressed event', async () => {
    const emp = await employee(false);
    const { tokenId } = await requestReset(emp.id);
    await relayAll();
    const d = await delivery(tokenId);
    expect(d.state).toBe('suppressed');
    await dispatchDueDeliveries();
    expect(mailSink.messages().filter((m) => m.to === emp.email)).toHaveLength(0);
    const ev = await query(`SELECT name FROM outbox_events WHERE aggregate_id = $1`, [d.id]);
    expect(ev.rows.map((r) => r.name)).toEqual(['notification.suppressed']);
  });

  it('recipient deactivated after queueing → suppressed at send time (C6 re-check)', async () => {
    const emp = await employee();
    const { tokenId } = await requestReset(emp.id);
    await relayAll();
    await query('UPDATE employees SET is_active = false WHERE id = $1', [emp.id]);
    await dispatchDueDeliveries();
    expect((await delivery(tokenId)).state).toBe('suppressed');
    expect(mailSink.messages().filter((m) => m.to === emp.email)).toHaveLength(0);
  });

  it(`EM-7: more than ${RESET_EMAILS_PER_HOUR} reset emails per hour are suppressed`, async () => {
    const emp = await employee();
    const tokens: string[] = [];
    for (let i = 0; i < RESET_EMAILS_PER_HOUR + 1; i++) tokens.push((await requestReset(emp.id)).tokenId);
    await relayAll();
    const states = await Promise.all(tokens.map(async (t) => (await delivery(t)).state));
    expect(states.filter((s) => s === 'pending')).toHaveLength(RESET_EMAILS_PER_HOUR);
    expect(states.filter((s) => s === 'suppressed')).toHaveLength(1);
  });

  it('retry with backoff 60 s / 10 min / 60 min, then Failed + notification.failed', async () => {
    const t0 = new Date(Date.now() + 5 * 60_000);
    clock.set(t0);
    const emp = await employee();
    const { tokenId } = await requestReset(emp.id, 24 * 60);
    await relayAll();
    const transient: EmailSendResult = { ok: false, permanent: false, error: 'send failed (ETIMEDOUT)' };
    const t = new ScriptedTransport([transient, transient, transient, transient], emp.email);
    setEmailTransport(t);

    let at = t0.getTime();
    for (const delay of [60, 600, 3600]) {
      await dispatchDueDeliveries();
      const d = await delivery(tokenId);
      expect(d.state).toBe('retry_pending');
      expect(new Date(d.next_attempt_at).getTime()).toBe(at + delay * 1000);
      // Not due one second earlier.
      const n = t.sent.filter((m) => m.idempotencyKey === d.id).length;
      clock.set(new Date(at + delay * 1000 - 1000));
      await dispatchDueDeliveries();
      expect(t.sent.filter((m) => m.idempotencyKey === d.id).length).toBe(n);
      at += delay * 1000;
      clock.set(new Date(at));
    }
    await dispatchDueDeliveries();
    const d = await delivery(tokenId);
    expect(d.state).toBe('failed');
    expect(d.attempt_count).toBe(4);
    expect(d.last_error).toBe('send failed (ETIMEDOUT)');
    expect(t.sent.filter((m) => m.idempotencyKey === d.id)).toHaveLength(4);
    const ev = await query(`SELECT name, payload FROM outbox_events WHERE aggregate_id = $1`, [d.id]);
    expect(ev.rows).toEqual([{ name: 'notification.failed', payload: { deliveryId: d.id, family: 'security' } }]);
    const secret = await query('SELECT ciphertext FROM notification_secrets WHERE ref_id = $1', [tokenId]);
    expect(secret.rows[0].ciphertext).toBeNull();
  });

  it('permanent SMTP failure (5xx) → Failed at once', async () => {
    const emp = await employee();
    const { tokenId } = await requestReset(emp.id);
    await relayAll();
    setEmailTransport(new ScriptedTransport([{ ok: false, permanent: true, error: 'send failed (SMTP 550)' }], emp.email));
    await dispatchDueDeliveries();
    const d = await delivery(tokenId);
    expect(d.state).toBe('failed');
    expect(d.attempt_count).toBe(1);
  });

  it('expired link → skipped, not sent', async () => {
    const t0 = new Date(Date.now() + 10 * 60_000);
    clock.set(t0);
    const emp = await employee();
    const { tokenId } = await requestReset(emp.id);
    await relayAll();
    clock.set(new Date(t0.getTime() + 61 * 60_000));
    await dispatchDueDeliveries();
    expect((await delivery(tokenId)).state).toBe('skipped');
    expect(mailSink.messages().filter((m) => m.to === emp.email)).toHaveLength(0);
  });

  it('test-support mail sink is readable and clearable (NODE_ENV=test only)', async () => {
    const emp = await employee();
    await requestReset(emp.id);
    await request(app).post('/api/test-support/worker/tick').send({});
    await request(app).post('/api/test-support/jobs/notifications.delivery_dispatch/run').send({});
    const res = await request(app).get('/api/test-support/mail').query({ to: emp.email });
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].raw).toBeUndefined();
    expect((await request(app).delete('/api/test-support/mail')).body.cleared).toBe(true);
    expect(mailSink.messages()).toHaveLength(0);
  });

  it('in-app notifications inbox: list, unread-count, mark-as-read, and mark-all-read', async () => {
    const emp = await employee();
    await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [emp.id, await bcrypt.hash('Password123!', 4)]);
    const loginRes = await request(app).post('/api/auth/login').set('Origin', 'http://localhost:3000').send({ email: emp.email, password: 'Password123!' });
    const cookie = ([] as string[]).concat(loginRes.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`))?.split(';')[0] ?? '';
    const csrf = loginRes.body.csrfToken;

    // Seed two in-app notifications directly
    const n1 = await query<{ id: string }>(
      `INSERT INTO notification_deliveries (dedupe_key, recipient_id, template, family, channel, state)
       VALUES ($1, $2, 'deal_assigned', 'business', 'in_app', 'sent')
       RETURNING id`,
      [`test-inapp-1-${Date.now()}`, emp.id]
    );
    await query<{ id: string }>(
      `INSERT INTO notification_deliveries (dedupe_key, recipient_id, template, family, channel, state)
       VALUES ($1, $2, 'project_created', 'business', 'in_app', 'sent')
       RETURNING id`,
      [`test-inapp-2-${Date.now()}`, emp.id]
    );

    // Check unread count
    const countRes = await request(app).get('/api/notifications/unread-count').set('Cookie', cookie);
    expect(countRes.status).toBe(200);
    expect(countRes.body.unreadCount).toBe(2);

    // List notifications
    const listRes = await request(app).get('/api/notifications').set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(2);

    // Mark one as read
    const read1 = await request(app)
      .post(`/api/notifications/${n1.rows[0].id}/read`)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrf);
    expect(read1.status).toBe(200);

    const countRes2 = await request(app).get('/api/notifications/unread-count').set('Cookie', cookie);
    expect(countRes2.body.unreadCount).toBe(1);

    // Mark all as read
    const readAll = await request(app)
      .post('/api/notifications/read-all')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrf);
    expect(readAll.status).toBe(200);
    expect(readAll.body.markedCount).toBe(1);

    const countRes3 = await request(app).get('/api/notifications/unread-count').set('Cookie', cookie);
    expect(countRes3.body.unreadCount).toBe(0);
  });

  it('delivery monitor: lists deliveries and reminders for Owner', async () => {
    const monitorRes = await request(app).get('/api/delivery-monitor').set('Cookie', await ownerCookie());
    expect(monitorRes.status).toBe(200);
    expect(monitorRes.body).toHaveProperty('items');
    expect(monitorRes.body).toHaveProperty('total');
  });
});
