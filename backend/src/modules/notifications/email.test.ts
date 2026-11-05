/**
 * Email transport + template tests (no DB, no network). Threat model EM-1/EM-2/EM-3/EM-5,
 * security checklist "template escaping test with \r\n and <script> in a business name".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { assertEmailConfigSafe, EMAIL_NOT_CONFIGURED, emailDeliveryWarning, loadEmailConfig } from './emailConfig.js';
import { escapeHtml, renderEmail, stripControl, SUBJECT_MAX, TemplateError } from './templates.js';
import {
  classifySendError,
  createMemoryTransport,
  createTransportFromConfig,
  LogEmailTransport,
  mailSink,
  NodemailerEmailTransport,
  prepareMessage,
  redactLinkTokens,
  UnconfiguredEmailTransport,
} from './transport.js';
import { decryptSecret, encryptSecret } from './secrets.js';

const EVIL_NAME = 'Acme\r\nBcc: victim@evil.test\r\n<script>alert(1)</script>"\'&';

describe('templates: escaping', () => {
  it('HTML-escapes variables and strips CR/LF from every part', () => {
    const r = renderEmail('business.developer_handoff', { name: 'Dev <b>x</b>', businessName: EVIL_NAME, url: 'https://app.test/deals/1' });
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(r.html).toContain('&quot;&#39;&amp;');
    expect(r.html).not.toContain('<b>x</b>');
    expect(r.subject).not.toMatch(/[\r\n]/);
    expect(r.text).not.toMatch(/\r/);
    expect(r.text).not.toContain('\nBcc:');
    expect(r.subject).toContain('Acme Bcc: victim@evil.test');
  });

  it('limits the subject to 150 characters', () => {
    const r = renderEmail('business.correction_request', { name: 'n', businessName: 'x'.repeat(400), url: 'https://app.test/c/1' });
    expect(r.subject.length).toBeLessThanOrEqual(SUBJECT_MAX);
  });

  it('rejects non-http(s) and credentialed links, and missing variables', () => {
    expect(() => renderEmail('business.assignment', { name: 'n', url: 'javascript:alert(1)' })).toThrow(TemplateError);
    expect(() => renderEmail('business.assignment', { name: 'n', url: 'https://u:p@app.test/' })).toThrow(TemplateError);
    expect(() => renderEmail('business.assignment', { name: 'n' })).toThrow(/Missing template variable/);
  });

  it('link attribute is escaped (no attribute break-out)', () => {
    const r = renderEmail('business.assignment', { name: 'n', url: 'https://app.test/q?a="><script>' });
    expect(r.html).not.toContain('"><script>');
  });

  it('helpers', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    expect(stripControl('a\r\nb c\u0000d')).toBe('a b c d');
  });
});

describe('transport: header injection through real nodemailer (jsonTransport/streamTransport)', () => {
  it('builds the MIME message without injected headers', async () => {
    const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    let raw = '';
    const t = new NodemailerEmailTransport('memory', transporter, 'no-reply@udigity.test', (_p, info) => {
      raw = String((info as { message: Buffer }).message);
    });
    const res = await t.send({
      to: 'dev@udigity.test',
      template: 'business.developer_handoff',
      idempotencyKey: '7f9c2ba4-e88f-41b3-9c3a-1f0b5b1a1a11',
      vars: { name: EVIL_NAME, businessName: EVIL_NAME, url: 'https://app.test/deals/1' },
    });
    expect(res.ok).toBe(true);
    const headers = raw.split('\n\n')[0];
    expect(headers).not.toMatch(/^Bcc:/im);
    expect(headers).toMatch(/^Message-ID: <7f9c2ba4-e88f-41b3-9c3a-1f0b5b1a1a11@udigity\.test>$/m);
    expect(headers.split('\n').filter((l) => /^Subject:/i.test(l))).toHaveLength(1);
    expect(raw.split('text/html')[1]).not.toContain('<script>');
  });

  it('rejects a recipient with CR/LF or an invalid address (permanent failure)', async () => {
    const t = createMemoryTransport('no-reply@udigity.test');
    const r = await t.send({ to: 'a@b.test\r\nBcc: x@y.test', template: 'business.assignment', idempotencyKey: 'k', vars: { name: 'n', url: 'https://a.test/' } });
    expect(r).toEqual(expect.objectContaining({ ok: false, permanent: true }));
    expect(() =>
      prepareMessage({ to: 'not-an-email', template: 'business.assignment', idempotencyKey: 'k', vars: { name: 'n', url: 'https://a.test/' } }, 'f@x.test')
    ).toThrow();
  });

  it('memory sink keeps the rendered message (JSON transport)', async () => {
    mailSink.clear();
    const t = createMemoryTransport('no-reply@udigity.test');
    await t.send({ to: 'x@udigity.test', template: 'security.password_reset', idempotencyKey: 'id1', vars: { name: 'X', resetUrl: 'https://app.test/reset-password?token=abc', ttlMinutes: '60' } });
    const [m] = mailSink.messages();
    expect(m.template).toBe('security.password_reset');
    expect(m.text).toContain('https://app.test/reset-password?token=abc');
    expect(JSON.parse(m.raw).subject).toBe('Reset your Udigity password');
  });

  it('classifies SMTP errors: 5xx permanent, 4xx/network transient, no secrets in message', () => {
    expect(classifySendError(Object.assign(new Error('550 user unknown x@y'), { responseCode: 550 }))).toEqual({ permanent: true, error: 'send failed (SMTP 550)' });
    expect(classifySendError(Object.assign(new Error('421'), { responseCode: 421 })).permanent).toBe(false);
    expect(classifySendError(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))).toEqual({ permanent: false, error: 'send failed (ETIMEDOUT)' });
  });
});

describe('email config: no real send', () => {
  afterEach(() => vi.restoreAllMocks());

  it('SMTP_HOST empty → log transport in development (no network)', () => {
    const cfg = loadEmailConfig({ SMTP_HOST: '' }, 'development');
    expect(cfg.transport).toBe('log');
    const spy = vi.spyOn(nodemailer, 'createTransport');
    const t = createTransportFromConfig(cfg);
    expect(t.kind).toBe('log');
    expect(spy).not.toHaveBeenCalled();
  });

  it('FX-MAIL: production without a real sender → none (refuses every message, loud start-up error)', async () => {
    for (const env of [{ SMTP_HOST: '' }, { SMTP_HOST: 'smtp.example.test', EMAIL_TRANSPORT: 'log', EMAIL_ALLOW_REAL_SEND: 'true' }]) {
      const cfg = loadEmailConfig(env, 'production');
      expect(cfg.transport).toBe('none');
      expect(() => assertEmailConfigSafe(cfg)).not.toThrow();
      expect(emailDeliveryWarning(cfg)).toMatch(/^ERROR: NODE_ENV=production without a real email transport/);
      const spy = vi.spyOn(nodemailer, 'createTransport');
      const t = createTransportFromConfig(cfg);
      expect(t.kind).toBe('none');
      expect(spy).not.toHaveBeenCalled();
      expect(await t.send({ to: 'a@udigity.test', template: 'business.assignment', idempotencyKey: 'k', vars: { name: 'n', url: 'https://a.test/' } })).toEqual({
        ok: false,
        permanent: true,
        error: EMAIL_NOT_CONFIGURED,
      });
    }
    expect(emailDeliveryWarning(loadEmailConfig({}, 'development'))).toBeNull();
    expect(new UnconfiguredEmailTransport().kind).toBe('none');
  });

  it('NODE_ENV=test → memory sink even when SMTP_HOST is set', () => {
    expect(loadEmailConfig({ SMTP_HOST: 'smtp.example.test', EMAIL_ALLOW_REAL_SEND: 'true' }, 'test').transport).toBe('memory');
  });

  it('SMTP_HOST set without EMAIL_ALLOW_REAL_SEND: worker refuses, API falls back to log', () => {
    const cfg = loadEmailConfig({ SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587' }, 'production');
    expect(cfg.transport).toBe('smtp');
    expect(() => assertEmailConfigSafe(cfg)).toThrow(/EMAIL_ALLOW_REAL_SEND/);
    expect(createTransportFromConfig(cfg).kind).toBe('log');
  });

  it('EMAIL_TRANSPORT=log wins over SMTP_HOST; bad values are rejected', () => {
    expect(loadEmailConfig({ SMTP_HOST: 'h', EMAIL_TRANSPORT: 'log' }, 'development').transport).toBe('log');
    expect(() => loadEmailConfig({ EMAIL_TRANSPORT: 'sendmail' }, 'production')).toThrow();
    expect(() => loadEmailConfig({ SMTP_FROM: 'a@b.test\r\nBcc: c@d.test' }, 'production')).toThrow();
    expect(() => loadEmailConfig({ SMTP_HOST: 'h', SMTP_PORT: '99999' }, 'production')).toThrow();
  });

  it('log transport writes one redacted line: no full address, no link outside development', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const r = await new LogEmailTransport('no-reply@udigity.test').send({
      to: 'person@udigity.test',
      template: 'security.password_reset',
      idempotencyKey: 'd-1',
      vars: { name: 'P', resetUrl: 'https://app.test/reset-password?token=SECRET', ttlMinutes: '60' },
    });
    expect(r.ok).toBe(true);
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0][0]);
    expect(line).toContain('template=security.password_reset');
    expect(line).toContain('to=*@udigity.test');
    expect(line).not.toContain('person@');
    expect(line).not.toContain('SECRET');
    expect(line).toContain('link=https://app.test/reset-password?token=[redacted]');
  });

  it('FX-MAIL: the log transport redacts setup / reset tokens; the full link needs development + EMAIL_LOG_LINKS', async () => {
    const raw = 'a'.repeat(64);
    const send = (t: LogEmailTransport) =>
      t.send({
        to: 'new@udigity.test',
        template: 'security.credential_setup',
        idempotencyKey: 'd-2',
        vars: { name: 'N', setupUrl: `https://app.test/reset-password?token=${raw}` },
      });
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    // config.env is 'test' here, so even an explicit reveal flag prints the redacted link.
    await send(new LogEmailTransport('no-reply@udigity.test', true));
    await send(createTransportFromConfig(loadEmailConfig({ EMAIL_LOG_LINKS: 'true' }, 'development')) as LogEmailTransport);
    for (const [line] of info.mock.calls) {
      expect(String(line)).not.toContain(raw);
      expect(String(line)).toContain('token=[redacted]');
    }
    expect(loadEmailConfig({ EMAIL_LOG_LINKS: 'true' }, 'development').revealLinks).toBe(true);
    expect(loadEmailConfig({ EMAIL_LOG_LINKS: 'true', SMTP_HOST: '' }, 'production').revealLinks).toBe(false);
    expect(loadEmailConfig({}, 'development').revealLinks).toBe(false);
    expect(redactLinkTokens(`see https://a.test/reset-password?token=${raw}&x=1 and https://a.test/p?code=123#key=9`)).toBe(
      'see https://a.test/reset-password?token=[redacted]&x=1 and https://a.test/p?code=[redacted]#key=[redacted]'
    );
  });
});

describe('notification secrets', () => {
  it('round-trips and is bound to its row id', () => {
    const c = encryptSecret('raw-token', 'row-a');
    expect(c).not.toContain('raw-token');
    expect(decryptSecret(c, 'row-a')).toBe('raw-token');
    expect(decryptSecret(c, 'row-b')).toBeNull();
    expect(decryptSecret('v1.x.y.z', 'row-a')).toBeNull();
  });
});
