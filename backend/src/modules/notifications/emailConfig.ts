/**
 * Email configuration (BE5's own config module; plan §7.2, security checklist A8/A9).
 * The only place outside config/index.ts that reads env, and only these keys. Values are never logged.
 *
 * Env keys (DEV-R4 names + plan §7.2 names):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM (alias EMAIL_FROM)
 *   EMAIL_TRANSPORT=log|smtp (optional; default: smtp when SMTP_HOST is set, otherwise log)
 *   EMAIL_ALLOW_REAL_SEND=true   required for smtp; without it the worker refuses to start.
 *   EMAIL_LOG_LINKS=true         development only: the log transport prints the full link (token included).
 *
 * Resolution:
 *   NODE_ENV=test           → memory (test sink; nodemailer jsonTransport, no network) — always.
 *   SMTP_HOST empty         → log (one redacted line per message, no network); production: none.
 *   EMAIL_TRANSPORT=log     → log; production: none.
 *   otherwise               → smtp (only with EMAIL_ALLOW_REAL_SEND=true).
 *
 * `none` (FX-MAIL): production never silently "sends" to a log. The worker starts (relay, reminders and
 * attendance jobs must keep running) but logs a start-up ERROR, and J-02 records every email delivery as
 * `failed` with last_error EMAIL_NOT_CONFIGURED, visible on the Delivery monitor (SCR-OWN-012).
 */
import { config, ConfigError } from '../../config/index.js';

type Env = Record<string, string | undefined>;

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface EmailConfig {
  transport: 'log' | 'smtp' | 'memory' | 'none';
  from: string;
  allowRealSend: boolean;
  smtp: SmtpSettings | null;
  /** Log transport prints the full link. Only ever true with NODE_ENV=development and EMAIL_LOG_LINKS=true. */
  revealLinks: boolean;
}

/** last_error of an email delivery the worker refused to send (production without a real sender). */
export const EMAIL_NOT_CONFIGURED = 'email transport not configured';

const ADDRESS_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export function loadEmailConfig(env: Env, appEnv: string = config.env): EmailConfig {
  const host = (env.SMTP_HOST ?? '').trim();
  const from = (env.SMTP_FROM || env.EMAIL_FROM || 'no-reply@udigity.invalid').trim();
  if (!ADDRESS_RE.test(from) || /[\r\n]/.test(from)) throw new ConfigError('SMTP_FROM must be a plain email address');
  const allowRealSend = env.EMAIL_ALLOW_REAL_SEND === 'true';
  const requested = (env.EMAIL_TRANSPORT ?? '').trim();
  if (requested && requested !== 'log' && requested !== 'smtp') throw new ConfigError('EMAIL_TRANSPORT must be log or smtp');

  const revealLinks = appEnv === 'development' && env.EMAIL_LOG_LINKS === 'true';

  if (appEnv === 'test') return { transport: 'memory', from, allowRealSend: false, smtp: null, revealLinks: false };
  if (!host || requested === 'log') {
    return { transport: appEnv === 'production' ? 'none' : 'log', from, allowRealSend, smtp: null, revealLinks };
  }

  const portRaw = env.SMTP_PORT ?? '';
  const port = portRaw === '' ? 587 : Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new ConfigError('SMTP_PORT must be a valid port');
  return {
    transport: 'smtp',
    from,
    allowRealSend,
    smtp: { host, port, secure: env.SMTP_SECURE === 'true', user: env.SMTP_USER ?? '', pass: env.SMTP_PASS ?? '' },
    revealLinks: false,
  };
}

/** Worker start-up guard (plan §7.2): smtp without explicit EMAIL_ALLOW_REAL_SEND=true is refused. */
export function assertEmailConfigSafe(cfg: EmailConfig): void {
  if (cfg.transport === 'smtp' && !cfg.allowRealSend) {
    throw new ConfigError(
      'SMTP_HOST is set but EMAIL_ALLOW_REAL_SEND is not "true": refusing to start with a real SMTP transport. ' +
        'Unset SMTP_HOST (log transport) or get user approval for real email.'
    );
  }
}

/** Safe description for start-up logs (no host, user or password). */
export function describeEmailConfig(cfg: EmailConfig): string {
  if (cfg.transport === 'none') return 'email transport=none (production: email delivery is OFF)';
  return `email transport=${cfg.transport}${cfg.transport === 'smtp' ? ' (real send enabled)' : ' (no network)'}`;
}

/** Loud start-up warning when production has no real sender (null when email can be sent or this is dev/test). */
export function emailDeliveryWarning(cfg: EmailConfig): string | null {
  if (cfg.transport !== 'none') return null;
  return (
    'ERROR: NODE_ENV=production without a real email transport (SMTP_HOST empty or EMAIL_TRANSPORT=log). ' +
    'Invitation and password-reset emails are NOT sent; each one is recorded as failed ' +
    `("${EMAIL_NOT_CONFIGURED}") on the Delivery monitor. See devops/DEPLOY.md section 10.`
  );
}
