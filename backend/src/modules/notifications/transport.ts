/**
 * EmailTransport implementations (shared/outbox.ts contract; plan §7.2). Owner: BE5.
 * - log:    development default. One redacted line (template, recipient domain, idempotency key, link with
 *           its token replaced by [redacted]). No network. The full link only with NODE_ENV=development
 *           and EMAIL_LOG_LINKS=true (so a developer can finish the flow); never in production.
 * - memory: tests. A real nodemailer jsonTransport builds the full MIME message in memory; the sink
 *           keeps it for assertions. No network.
 * - smtp:   nodemailer SMTP. Only with EMAIL_ALLOW_REAL_SEND=true (worker refuses otherwise).
 * - none:   production without a real sender. Sends nothing; every message fails with EMAIL_NOT_CONFIGURED.
 * log/memory successes are "captured", smtp successes "accepted by the provider" (J-02 states).
 * Addresses are passed as { name, address } objects; no header is ever built from data (EM-1).
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { z } from 'zod';
import { config } from '../../config/index.js';
import type { EmailMessage, EmailSendResult, EmailTransport } from '../../shared/outbox.js';
import { EMAIL_NOT_CONFIGURED, loadEmailConfig, type EmailConfig } from './emailConfig.js';
import { renderEmail, stripControl } from './templates.js';

const RecipientSchema = z.string().email().max(254).refine((v) => !/[\r\n]/.test(v));

export interface PreparedMessage {
  from: { name: string; address: string };
  to: { name: string; address: string };
  subject: string;
  text: string;
  html: string;
  messageId: string;
}

function domainOf(address: string): string {
  return address.split('@')[1] ?? 'invalid';
}

/** Validate the recipient, render the template and build the nodemailer message object. */
export function prepareMessage(message: EmailMessage, from: string): PreparedMessage {
  const to = RecipientSchema.safeParse(message.to);
  if (!to.success) throw new Error('Invalid recipient address');
  const rendered = renderEmail(message.template, message.vars);
  const keyPart = message.idempotencyKey.replace(/[^A-Za-z0-9.-]/g, '').slice(0, 64) || 'msg';
  return {
    from: { name: 'Udigity', address: from },
    to: { name: stripControl(message.vars.name ?? '').slice(0, 100), address: to.data },
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    // Message-ID = delivery row id (provider idempotency key, plan §7.2).
    messageId: `<${keyPart}@${domainOf(from)}>`,
  };
}

/** Replace the value of token-like query parameters in every URL of `text` (reset / setup links). */
export function redactLinkTokens(text: string): string {
  return text.replace(/([?&#](?:token|code|key|secret)=)[^&#\s"'<>]+/gi, '$1[redacted]');
}

/** nodemailer error → permanent (SMTP 5xx / invalid message) vs transient. */
export function classifySendError(err: unknown): { permanent: boolean; error: string } {
  const e = err as { responseCode?: number; code?: string; name?: string };
  const code = typeof e?.responseCode === 'number' ? e.responseCode : undefined;
  const permanent = (code !== undefined && code >= 500 && code < 600) || e?.code === 'EENVELOPE' || e?.code === 'EMESSAGE';
  const label = code !== undefined ? `SMTP ${code}` : e?.code ? String(e.code) : (e?.name ?? 'Error');
  return { permanent, error: `send failed (${label})`.slice(0, 200) };
}

/** Wrap any nodemailer transporter as an EmailTransport. */
export class NodemailerEmailTransport implements EmailTransport {
  constructor(
    readonly kind: 'smtp' | 'memory',
    private readonly transporter: Transporter,
    private readonly from: string,
    private readonly onSent?: (prepared: PreparedMessage, info: unknown, message: EmailMessage) => void
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let prepared: PreparedMessage;
    try {
      prepared = prepareMessage(message, this.from);
    } catch (err) {
      return { ok: false, permanent: true, error: `render failed (${(err as Error).name})` };
    }
    try {
      const info = await this.transporter.sendMail({ ...prepared, disableFileAccess: true, disableUrlAccess: true });
      this.onSent?.(prepared, info, message);
      const id = (info as { messageId?: string }).messageId;
      return { ok: true, providerMessageId: id ? String(id).slice(0, 200) : undefined };
    } catch (err) {
      const c = classifySendError(err);
      return { ok: false, permanent: c.permanent, error: c.error };
    }
  }
}

export class LogEmailTransport implements EmailTransport {
  readonly kind = 'log' as const;
  /** `revealLinks` comes from loadEmailConfig (development + EMAIL_LOG_LINKS=true only) and is re-checked here. */
  constructor(private readonly from: string, private readonly revealLinks = false) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let prepared: PreparedMessage;
    try {
      prepared = prepareMessage(message, this.from);
    } catch (err) {
      return { ok: false, permanent: true, error: `render failed (${(err as Error).name})` };
    }
    const line = `[email:log] template=${message.template} to=*@${domainOf(prepared.to.address)} key=${message.idempotencyKey}`;
    const link = /https?:\/\/\S+/.exec(prepared.text)?.[0];
    const shown = link && this.revealLinks && config.env === 'development' ? link : link ? redactLinkTokens(link) : null;
    console.info(shown ? `${line} link=${shown}` : line);
    return { ok: true, providerMessageId: `log:${message.idempotencyKey}` };
  }
}

/** Production without a real sender: refuses every message (permanent), so nothing is reported as sent. */
export class UnconfiguredEmailTransport implements EmailTransport {
  readonly kind = 'none' as const;
  async send(): Promise<EmailSendResult> {
    return { ok: false, permanent: true, error: EMAIL_NOT_CONFIGURED };
  }
}

// ---------------------------------------------------------------------------
// Memory sink (tests, QA-2 readable mail sink)
// ---------------------------------------------------------------------------

export interface SinkMessage {
  to: string;
  template: EmailMessage['template'];
  subject: string;
  text: string;
  html: string;
  messageId: string;
  /** Full JSON message produced by nodemailer's jsonTransport. */
  raw: string;
  at: string;
}

const sink: SinkMessage[] = [];
const SINK_MAX = 500;

export const mailSink = {
  messages(): readonly SinkMessage[] {
    return sink;
  },
  clear(): void {
    sink.length = 0;
  },
};

export function createMemoryTransport(from: string): NodemailerEmailTransport {
  const transporter = nodemailer.createTransport({ jsonTransport: true });
  return new NodemailerEmailTransport('memory', transporter, from, (prepared, info, message) => {
    if (sink.length >= SINK_MAX) sink.shift();
    sink.push({
      to: prepared.to.address,
      template: message.template,
      subject: prepared.subject,
      text: prepared.text,
      html: prepared.html,
      messageId: prepared.messageId,
      raw: String((info as { message?: unknown }).message ?? ''),
      at: new Date().toISOString(),
    });
  });
}

export function createSmtpTransport(cfg: EmailConfig): NodemailerEmailTransport {
  if (!cfg.smtp) throw new Error('SMTP settings missing');
  const transporter = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure,
    requireTLS: !cfg.smtp.secure && !cfg.smtp.allowPlaintext, // EM-6: never plain text (dev catcher excepted)
    ...(cfg.smtp.allowPlaintext ? { ignoreTLS: true } : {}),
    auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined,
    logger: false,
    debug: false,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return new NodemailerEmailTransport('smtp', transporter, cfg.from);
}

export function createTransportFromConfig(cfg: EmailConfig): EmailTransport {
  if (cfg.transport === 'memory') return createMemoryTransport(cfg.from);
  if (cfg.transport === 'none') return new UnconfiguredEmailTransport();
  if (cfg.transport === 'smtp') {
    // API process / refused worker: never send for real, and never pretend to in production.
    if (!cfg.allowRealSend) return config.isProduction ? new UnconfiguredEmailTransport() : new LogEmailTransport(cfg.from);
    return createSmtpTransport(cfg);
  }
  return new LogEmailTransport(cfg.from, cfg.revealLinks);
}

// ---------------------------------------------------------------------------
// Active transport (lazy; tests may replace it)
// ---------------------------------------------------------------------------

let active: EmailTransport | null = null;

export function getEmailTransport(): EmailTransport {
  if (!active) active = createTransportFromConfig(loadEmailConfig(process.env));
  return active;
}

/** Tests only: replace the transport (null = rebuild from config on next use). */
export function setEmailTransport(next: EmailTransport | null): void {
  active = next;
}
