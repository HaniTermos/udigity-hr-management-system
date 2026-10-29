/**
 * Operator failure alerts (2026-10-29 request): raiseOpsAlert dedupes per kind per 15-minute window,
 * never throws, J-14 emails only to ALERT_EMAIL_TO, and an unexpected API error records an alert with
 * the route pattern only (no query string).
 */
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { pool, query } from '../db/pool.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { OPS_ALERT_WINDOW_MINUTES, raiseOpsAlert } from '../shared/opsAlert.js';
import { alertRecipients, sendOpsAlerts } from '../modules/notifications/opsAlerts.js';
import { createMemoryTransport, mailSink, setEmailTransport } from '../modules/notifications/transport.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const kind = () => `test.${crypto.randomUUID()}`;
const rowsOf = async (k: string) => (await query(`SELECT * FROM ops_alerts WHERE kind = $1 ORDER BY created_at`, [k])).rows;

describe('alertRecipients', () => {
  it('keeps valid addresses only', () => {
    expect(alertRecipients(' ops@udigity.test, not-an-email ,,b@udigity.test ')).toEqual(['ops@udigity.test', 'b@udigity.test']);
    expect(alertRecipients('')).toEqual([]);
  });
});

describe.skipIf(!hasTestDb)('ops alerts', () => {
  const savedTo = process.env.ALERT_EMAIL_TO;
  afterEach(() => {
    process.env.ALERT_EMAIL_TO = savedTo;
    setEmailTransport(null);
    mailSink.clear();
  });
  afterAll(async () => {
    await query(`DELETE FROM ops_alerts WHERE kind LIKE 'test.%' OR kind LIKE 'api.error:GET /__ops_test%'`);
    await pool.end();
  });

  it('one row per kind per window; repeats count occurrences', async () => {
    const k = kind();
    const t = new Date('2026-10-29T10:01:00Z');
    await raiseOpsAlert(k, 'first', pool, t);
    await raiseOpsAlert(k, 'second', pool, new Date(t.getTime() + 60_000));
    let rows = await rowsOf(k);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ detail: 'first', occurrences: 2, sent_at: null });
    await raiseOpsAlert(k, 'next window', pool, new Date(t.getTime() + OPS_ALERT_WINDOW_MINUTES * 60_000));
    rows = await rowsOf(k);
    expect(rows).toHaveLength(2);
  });

  it('never throws, even when the database call fails', async () => {
    const broken = { query: async () => Promise.reject(new Error('db down')) } as unknown as typeof pool;
    await expect(raiseOpsAlert(kind(), 'x', broken)).resolves.toBeUndefined();
  });

  it('J-14 sends nothing without ALERT_EMAIL_TO, then emails once to the address', async () => {
    const k = kind();
    await raiseOpsAlert(k, 'job x failed 3 times');
    setEmailTransport(createMemoryTransport('alerts@udigity.test'));

    process.env.ALERT_EMAIL_TO = '';
    await sendOpsAlerts();
    expect(mailSink.messages()).toHaveLength(0);
    expect((await rowsOf(k))[0].sent_at).toBeNull();

    process.env.ALERT_EMAIL_TO = 'ops@udigity.test';
    await sendOpsAlerts();
    const sent = mailSink.messages().filter((m) => m.to === 'ops@udigity.test' && m.subject.includes(k));
    expect(sent).toHaveLength(1);
    expect(sent[0].template).toBe('ops.alert');
    expect(sent[0].text).toContain('job x failed 3 times');
    expect((await rowsOf(k))[0].sent_at).not.toBeNull();

    await sendOpsAlerts();
    expect(mailSink.messages().filter((m) => m.subject.includes(k))).toHaveLength(1);
  });

  it('an unexpected API error records api.error:<route> with the route pattern, not the query string', async () => {
    const mini = express();
    mini.get('/__ops_test/:id', () => {
      throw new Error('boom with secret detail');
    });
    mini.use(errorHandler);
    const res = await request(mini).get('/__ops_test/123?token=abc');
    expect(res.status).toBe(500);
    await new Promise((r) => setTimeout(r, 200));
    const { rows } = await query(`SELECT detail FROM ops_alerts WHERE kind = 'api.error:GET /__ops_test/:id'`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].detail).not.toContain('token');
    expect(rows[0].detail).not.toContain('secret');
  });
});
