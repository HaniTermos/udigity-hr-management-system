/**
 * Background jobs + idempotency CONTRACT (ADR-004/005, arch-a §4.1–§4.3, §4.6.2; plan.md §8).
 * Owner: Tech Lead. Implementation: BE5 (`modules/platform`).
 *
 * - Jobs are rows in PostgreSQL, claimed with `FOR UPDATE SKIP LOCKED` + a lease. No Redis/broker.
 * - Recurring jobs: a one-minute scheduler tick inserts (kind, slot) rows with ON CONFLICT DO NOTHING,
 *   so a restart or a second worker never runs the same slot twice. Handlers are idempotent.
 * - The worker is a separate process (`npm run worker`) from the same image; one container on the VPS.
 * - Each job kind is owned by exactly one module (the prefix before the dot).
 */
import type { Queryable } from '../db/pool.js';
import type { CommandContext } from './tx.js';

/** Job kinds from arch-a §4.6.2 (J-03..J-12) plus BE5 delivery kinds. */
export type JobKind =
  | 'platform.outbox_relay' // J-03
  | 'notifications.reminder_dispatch' // J-01
  | 'notifications.delivery_dispatch' // J-02 (email retries 60 s / 10 min / 60 min)
  | 'notifications.daily_digest' // J-13 (D18 shift-start digests, in-app)
  | 'notifications.ops_alerts' // J-14 (operator failure alerts → ALERT_EMAIL_TO)
  | 'attendance.exception_check' // J-04
  | 'reservation.expiry_sweep' // J-05
  | 'identity.session_cleanup' // J-06
  | 'projects.provision_retry' // J-07
  | 'reports.daily_snapshot' // J-08 (not in v1, OQ-17)
  | 'platform.heartbeat' // J-09
  | 'platform.retention_purge'; // J-12

export interface JobSchedule {
  /** `every:<seconds>` or `daily:<HH:MM>` in company time (needs `company.timezone`). */
  spec: `every:${number}` | `daily:${string}`;
}

export interface JobHandler {
  kind: JobKind;
  /** Present for recurring jobs; absent for enqueue-only kinds. */
  schedule?: JobSchedule;
  maxAttempts: number;
  /** Lease length; a crashed run becomes claimable again after it. */
  leaseSeconds: number;
  run(ctx: CommandContext, job: { id: string; payload: Record<string, unknown>; attempt: number }): Promise<void>;
}

export interface JobQueue {
  /** Enqueue in the caller's transaction. `dedupeKey` makes it idempotent (unique per kind). */
  enqueue(
    tx: Queryable,
    kind: JobKind,
    options: { dedupeKey: string; runAt?: Date; payload?: Record<string, unknown> }
  ): Promise<void>;
}

const handlers = new Map<JobKind, JobHandler>();

export function registerJob(handler: JobHandler): void {
  if (handlers.has(handler.kind)) throw new Error(`Job kind registered twice: ${handler.kind}`);
  handlers.set(handler.kind, handler);
}

export function getJobHandlers(): readonly JobHandler[] {
  return [...handlers.values()];
}

let queue: JobQueue = {
  async enqueue(_tx, kind) {
    throw new Error(`Job queue not registered (kind ${kind}); BE5 platform module must init first`);
  },
};

export function registerJobQueue(next: JobQueue): void {
  queue = next;
}

export const jobs: JobQueue = {
  enqueue: (tx, kind, options) => queue.enqueue(tx, kind, options),
};

// ---------------------------------------------------------------------------
// Idempotency (IC-23, arch-b §8 rule 5). Header `Idempotency-Key` on write endpoints.
// BE5 provides `idempotent(operation)` Express middleware backed by IdempotencyRecord
// (actor, operation, key) -> stored status + body, retention `retention.idempotencyHours`.
// Same key + different body hash -> 409 IDEMPOTENCY_KEY_REUSED.
// ---------------------------------------------------------------------------

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export interface IdempotencyStore {
  lookup(
    db: Queryable,
    key: { actorId: string; operation: string; key: string }
  ): Promise<{ requestHash: string; status: number; body: unknown } | null>;
  save(
    tx: Queryable,
    key: { actorId: string; operation: string; key: string },
    record: { requestHash: string; status: number; body: unknown }
  ): Promise<void>;
}
