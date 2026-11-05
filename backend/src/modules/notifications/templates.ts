/**
 * Code-defined email templates (plan §7.2; threat model EM-1/EM-2/EM-3). Owner: BE5.
 * - Plain text first, minimal HTML second. No tracking pixels, no remote images, no custom headers.
 * - Every variable is escaped: HTML-escaped in the HTML part; CR/LF and control characters removed
 *   everywhere; subjects limited to 150 characters (no header injection).
 * - Link variables must be absolute http(s) URLs (built by the caller from PUBLIC_APP_URL + a fixed path).
 * - Never put user-written free text (notes) into a template.
 */
import type { EmailTemplateId } from '../../shared/outbox.js';

interface TemplateDef {
  subject: string;
  /** Paragraphs; `{{name}}` placeholders. */
  body: string[];
  /** Optional call-to-action link: the var holding the URL and the label. */
  link?: { var: string; label: string };
  /** Required variable names. */
  vars: string[];
}

const T: Record<EmailTemplateId, TemplateDef> = {
  'security.credential_setup': {
    subject: 'Set up your Udigity account',
    body: ['Hello {{name}},', 'An account was created for you. Use the link below to set your password. The link can be used once.'],
    link: { var: 'setupUrl', label: 'Set your password' },
    vars: ['name', 'setupUrl'],
  },
  'security.password_reset': {
    subject: 'Reset your Udigity password',
    body: [
      'Hello {{name}},',
      'A password reset was requested for your account. The link below can be used once and expires in {{ttlMinutes}} minutes.',
      'If you did not request this, you can ignore this email.',
    ],
    link: { var: 'resetUrl', label: 'Reset password' },
    vars: ['name', 'resetUrl', 'ttlMinutes'],
  },
  'ops.alert': {
    subject: 'Udigity alert: {{kind}}',
    body: [
      'A failure was recorded by the Udigity system.',
      'Kind: {{kind}}',
      'Detail: {{detail}}',
      'First seen: {{at}} (UTC). Occurrences in this 15-minute window: {{occurrences}}.',
      'Check the server logs for this time. Repeats of the same kind in the window are not emailed again.',
    ],
    vars: ['kind', 'detail', 'at', 'occurrences'],
  },
  'security.password_reset_completed': {
    subject: 'Your Udigity password was changed',
    body: ['Hello {{name}},', 'Your password was changed and all sessions were signed out. If this was not you, contact the Owner.'],
    vars: ['name'],
  },
  'business.follow_up_reminder': {
    subject: 'Follow-up due {{dueAt}}: {{businessName}}',
    body: ['Hello {{name}},', 'You have a follow-up with {{businessName}} due {{dueAt}}.'],
    link: { var: 'url', label: 'Open follow-up' },
    vars: ['name', 'businessName', 'dueAt', 'url'],
  },
  'business.meeting_reminder': {
    subject: 'Meeting {{startsAt}}: {{businessName}}',
    body: ['Hello {{name}},', 'Reminder: meeting with {{businessName}} at {{startsAt}}.'],
    link: { var: 'url', label: 'Open meeting' },
    vars: ['name', 'businessName', 'startsAt', 'url'],
  },
  'business.assignment': {
    subject: 'New calling assignment',
    body: ['Hello {{name}},', 'You have a new calling assignment.'],
    link: { var: 'url', label: 'Open queue' },
    vars: ['name', 'url'],
  },
  'business.developer_handoff': {
    subject: 'New opportunity assigned: {{businessName}}',
    body: ['Hello {{name}},', 'The opportunity for {{businessName}} was assigned to you.'],
    link: { var: 'url', label: 'Open deal' },
    vars: ['name', 'businessName', 'url'],
  },
  'business.correction_request': {
    subject: 'Data correction request: {{businessName}}',
    body: ['Hello {{name}},', 'A data correction was requested for {{businessName}}.'],
    link: { var: 'url', label: 'Open request' },
    vars: ['name', 'businessName', 'url'],
  },
  'business.attendance_alert': {
    subject: 'Attendance: {{alert}}',
    body: ['Hello {{name}},', 'Attendance alert: {{alert}}.'],
    link: { var: 'url', label: 'Open attendance' },
    vars: ['name', 'alert', 'url'],
  },
  'business.delivery_failure': {
    subject: 'Notification delivery failed',
    body: ['Hello {{name}},', 'A notification could not be delivered. See the delivery monitor.'],
    link: { var: 'url', label: 'Open delivery monitor' },
    vars: ['name', 'url'],
  },
};

export const SUBJECT_MAX = 150;
const VAR_MAX = 300;

export class TemplateError extends Error {}

/** C0/C1 control characters (incl. CR/LF) and U+2028/U+2029 line separators. */
const CONTROL_RE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]+', 'g');

/** Remove CR/LF, other control characters and Unicode line separators; collapse whitespace. */
export function stripControl(value: string): string {
  return value.replace(CONTROL_RE, ' ').replace(/\s+/g, ' ').trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(raw: string): string {
  const v = stripControl(raw);
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    throw new TemplateError('Link variable is not an absolute URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new TemplateError('Link must be http(s)');
  if (url.username || url.password) throw new TemplateError('Link must not carry credentials');
  return url.toString();
}

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => vars[name] ?? '');
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderEmail(template: EmailTemplateId, rawVars: Record<string, string>): RenderedEmail {
  const def = T[template];
  if (!def) throw new TemplateError('Unknown template');
  const clean: Record<string, string> = {};
  for (const name of def.vars) {
    const raw = rawVars[name];
    if (typeof raw !== 'string' || raw.length === 0) throw new TemplateError(`Missing template variable ${name}`);
    clean[name] = def.link?.var === name ? safeUrl(raw) : stripControl(raw).slice(0, VAR_MAX);
  }
  const htmlVars = Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, escapeHtml(v)]));

  let subject = stripControl(fill(def.subject, clean));
  if (subject.length > SUBJECT_MAX) subject = `${subject.slice(0, SUBJECT_MAX - 1)}…`;

  const textParts = def.body.map((p) => fill(p, clean));
  const htmlParts = def.body.map((p) => `<p>${fill(escapeHtml(p), htmlVars)}</p>`);
  if (def.link) {
    const url = clean[def.link.var];
    textParts.push(`${def.link.label}: ${url}`);
    htmlParts.push(`<p><a href="${escapeHtml(url)}">${escapeHtml(def.link.label)}</a></p>`);
  }
  textParts.push('— Udigity Management System');
  htmlParts.push('<p>— Udigity Management System</p>');

  return {
    subject,
    text: textParts.join('\n\n'),
    html: `<!doctype html><html><body>${htmlParts.join('')}</body></html>`,
  };
}

export const TEMPLATE_IDS = Object.keys(T) as EmailTemplateId[];
