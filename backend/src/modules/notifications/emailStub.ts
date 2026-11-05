/**
 * DEPRECATED (Increment 2): replaced by the E-03 outbox path — `queuePasswordResetEmail(tx, …)` in
 * notifications/service.ts (relay J-03 → NotificationDelivery → J-02 → EmailTransport). Kept only
 * until identity switches over (REQUEST BE5-R1); delete afterwards.
 *
 * STUB email delivery. No email is sent and no network call is made.
 * Real delivery is the Outbox + J-03 relay + J-02 dispatch path (architecture-a §4.6), not built yet.
 *
 * In development the link is written to the server log so a developer can complete the flow.
 * In test and production the link (which contains a secret token) is never logged.
 */
import { config } from '../../config/index.js';

export interface StubEmail {
  kind: 'password_reset';
  to: string;
  link: string;
}

export type EmailSink = (email: StubEmail) => void;

let sink: EmailSink = (email) => {
  if (config.env === 'development') {
    console.info(`[email-stub] ${email.kind} for ${email.to}: ${email.link}`);
  } else {
    console.info(`[email-stub] ${email.kind} queued for delivery (stub; link not logged)`);
  }
};

export function sendEmailStub(email: StubEmail): void {
  sink(email);
}

/** Test hook: capture stubbed emails instead of logging them. */
export function setEmailSink(next: EmailSink): void {
  sink = next;
}
