/**
 * MOD-reservation — service (SM-RESERVATION-001; docs/implementation/calling-design.md §5). Owner: BE3.
 *
 * Timing values are Owner settings read through `getSetting` (reservation.*, DEC-004):
 * "Demonstration alternative — not approved (docs/policy-defaults.md)".
 *
 * Invariant used everywhere: every write sets `lease_expires_at = min(now + lease, idle deadline,
 * max-total deadline)`, so an Active row is live exactly while `now < lease_expires_at`. Expiry is
 * evaluated lazily (acquire / renew / save) and by the J-05 sweep; both use a conditional UPDATE,
 * so exactly one writer records `contact_reservation.expired`.
 *
 * The lease token is a concurrency token (ORCH-4 a): compared only together with the holder's
 * employee id, returned only to the holder, never logged, audited or put in the outbox.
 */
import type { Queryable } from '../../db/pool.js';
import { access, assertAllowed, type AccessDecision, type Action, type Principal } from '../../shared/access.js';
import { HttpError, notFound, notImplemented, ruleViolation, stateConflict } from '../../shared/errors.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import { outbox } from '../../shared/outbox.js';
import { getSetting } from '../admin/service.js';
import { clock } from '../platform/clock.js';
import * as repo from './repo.js';
import type { ReservationEndReason, ReservationRow } from './repo.js';
import type {
  OverrideResultDto,
  ReleaseResultDto,
  RenewResultDto,
  ReservationConflictDetails,
  ReservationHolderDto,
} from './schemas.js';

export type { ReservationRow } from './repo.js';

const MIN = 60_000;

// ---------------------------------------------------------------------------
// Settings (DEC-004 demonstration defaults)
// ---------------------------------------------------------------------------
export interface ReservationTimings {
  leaseSeconds: number;
  heartbeatSeconds: number;
  idleMinutes: number;
  idleWarningMinutes: number;
  maxTotalMinutes: number;
  ownerOverride: boolean;
}

export async function loadTimings(db: Queryable): Promise<ReservationTimings> {
  // Sequential: `db` is usually the command's transaction client (one query at a time).
  const leaseSeconds = await getSetting(db, 'reservation.leaseSeconds');
  const heartbeatSeconds = await getSetting(db, 'reservation.heartbeatSeconds');
  const idleMinutes = await getSetting(db, 'reservation.idleMinutes');
  const idleWarningMinutes = await getSetting(db, 'reservation.idleWarningMinutes');
  const maxTotalMinutes = await getSetting(db, 'reservation.maxTotalMinutes');
  const ownerOverride = await getSetting(db, 'reservation.ownerOverride');
  return {
    leaseSeconds,
    heartbeatSeconds,
    idleMinutes,
    idleWarningMinutes: Math.min(idleWarningMinutes, idleMinutes),
    maxTotalMinutes,
    ownerOverride,
  };
}

interface Deadlines {
  idle: Date;
  idleWarning: Date;
  maxTotal: Date;
  maxTotalWarning: Date;
}

function deadlines(row: Pick<ReservationRow, 'last_activity_at' | 'max_window_started_at'>, t: ReservationTimings): Deadlines {
  const act = row.last_activity_at.getTime();
  const win = row.max_window_started_at.getTime();
  const warnGap = (t.idleMinutes - t.idleWarningMinutes) * MIN;
  return {
    idle: new Date(act + t.idleMinutes * MIN),
    idleWarning: new Date(act + t.idleWarningMinutes * MIN),
    maxTotal: new Date(win + t.maxTotalMinutes * MIN),
    maxTotalWarning: new Date(win + t.maxTotalMinutes * MIN - warnGap),
  };
}

function leaseUntil(now: Date, d: Pick<Deadlines, 'idle' | 'maxTotal'>, t: ReservationTimings): Date {
  return new Date(Math.min(now.getTime() + t.leaseSeconds * 1000, d.idle.getTime(), d.maxTotal.getTime()));
}

/** Why an Active row has lapsed at `now`, or null while it is live. */
export function lapseReason(row: ReservationRow, t: ReservationTimings, now: Date): ReservationEndReason | null {
  if (row.state !== 'active') return null;
  if (now.getTime() < row.lease_expires_at.getTime()) return null;
  const d = deadlines(row, t);
  if (d.idle.getTime() <= row.lease_expires_at.getTime()) return 'idle';
  if (d.maxTotal.getTime() <= row.lease_expires_at.getTime()) return 'max_total';
  return 'lease_elapsed';
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export const reservationConflict = (details?: ReservationConflictDetails) =>
  new HttpError(409, 'RESERVATION_CONFLICT', 'Another user is working on this contact', details);

export const reservationLost = (reason: ReservationEndReason | 'token_mismatch') =>
  new HttpError(409, 'RESERVATION_LOST', 'Your reservation of this contact has ended', { reason });

// ---------------------------------------------------------------------------
// Shared calling-access helpers (used by calls and assignment too)
// ---------------------------------------------------------------------------
export function principalOf(ctx: CommandContext): Principal {
  if (ctx.actor.kind !== 'employee') throw new Error('Calling commands need an employee actor');
  return { employeeId: ctx.actor.employeeId, role: ctx.actor.role, sessionState: ctx.actor.sessionState };
}

/**
 * Calling surfaces (acquire, save, follow-ups): `full` / `owner`, or context-limited only through
 * DEC-002 row 5 (scheduled callback) — OI-27 confines other rows to their own surface.
 */
export function assertCallingAccess(decision: AccessDecision): void {
  assertAllowed(decision);
  if (decision.level === 'context_limited' && decision.exceptionRow !== 'R5_SCHEDULED_CALLBACK') {
    throw new HttpError(403, 'HIDDEN_BY_POLICY', 'Record hidden by policy');
  }
}

export async function checkBusiness(db: Queryable, principal: Principal, action: string, businessId: string): Promise<AccessDecision> {
  return access.check(db, principal, action as Action, { type: 'business', id: businessId });
}

/**
 * Resource-state guard for acquire (step 9: not Rejected, not archived). Registered by MOD-calls,
 * which owns the calling state (reservation never imports calls: dependency order arch-a §3.2.1).
 */
export type AcquireGuard = (tx: Queryable, businessId: string) => Promise<void>;
let acquireGuard: AcquireGuard = async () => {
  throw notImplemented('calls acquire guard');
};
export function registerAcquireGuard(guard: AcquireGuard): void {
  acquireGuard = guard;
}

// ---------------------------------------------------------------------------
// DTO mapping
// ---------------------------------------------------------------------------
function holderDto(row: ReservationRow, t: ReservationTimings, reentry: boolean): ReservationHolderDto {
  const d = deadlines(row, t);
  return {
    id: row.id,
    businessId: row.business_id,
    state: 'active',
    leaseToken: row.lease_token,
    acquiredAt: row.acquired_at.toISOString(),
    leaseExpiresAt: row.lease_expires_at.toISOString(),
    idleExpiresAt: d.idle.toISOString(),
    idleWarningAt: d.idleWarning.toISOString(),
    maxTotalExpiresAt: d.maxTotal.toISOString(),
    heartbeatSeconds: t.heartbeatSeconds,
    reentry,
  };
}

function renewDto(row: ReservationRow, t: ReservationTimings, now: Date): RenewResultDto {
  const d = deadlines(row, t);
  return {
    id: row.id,
    state: 'active',
    leaseExpiresAt: row.lease_expires_at.toISOString(),
    idleExpiresAt: d.idle.toISOString(),
    idleWarningAt: d.idleWarning.toISOString(),
    idleWarning: now.getTime() >= d.idleWarning.getTime(),
    maxTotalExpiresAt: d.maxTotal.toISOString(),
    maxTotalWarning: now.getTime() >= d.maxTotalWarning.getTime(),
    heartbeatSeconds: t.heartbeatSeconds,
  };
}

const auditPayload = (row: ReservationRow) => ({ businessId: row.business_id, holderId: row.holder_id });

/** End an Active row (conditional) and audit it in the same transaction. */
async function endRow(
  ctx: CommandContext,
  row: ReservationRow,
  state: 'released' | 'expired' | 'overridden',
  reason: ReservationEndReason,
  now: Date,
  extra: { endedBy?: string | null; overrideReason?: string } = {}
): Promise<ReservationRow | null> {
  const ended = await repo.endIfActive(ctx.tx, row.id, {
    state,
    reason,
    endedBy: extra.endedBy ?? null,
    overrideReason: extra.overrideReason ?? null,
    now,
  });
  if (!ended) return null;
  const eventName =
    state === 'released' ? 'contact_reservation.released' : state === 'expired' ? 'contact_reservation.expired' : 'contact_reservation.overridden';
  await audit(ctx, {
    eventName,
    entityType: 'contact_reservation',
    entityId: row.id,
    payload: { ...auditPayload(row), endReason: reason },
    before: { state: 'active' },
    after: { state, endReason: reason },
    reason: extra.overrideReason ?? null,
  });
  return ended;
}

/** Lazy expiry: flip a lapsed Active row to `expired` (audited once). Returns the reason or null if live. */
async function expireIfLapsed(ctx: CommandContext, row: ReservationRow, t: ReservationTimings, now: Date): Promise<ReservationEndReason | null> {
  const reason = lapseReason(row, t, now);
  if (!reason) return null;
  await endRow(ctx, row, 'expired', reason, now);
  return reason;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** POST /api/reservations — Start Contact (SEQ-09/10). */
export async function acquire(ctx: CommandContext, businessId: string): Promise<{ dto: ReservationHolderDto; created: boolean }> {
  const principal = principalOf(ctx);
  const now = clock.now();
  assertCallingAccess(await checkBusiness(ctx.tx, principal, 'reservation.acquire', businessId));
  await acquireGuard(ctx.tx, businessId);
  const t = await loadTimings(ctx.tx);

  const current = await repo.findActiveByBusiness(ctx.tx, businessId, true);
  if (current) {
    const lapsed = await expireIfLapsed(ctx, current, t, now);
    if (!lapsed) {
      if (current.holder_id === principal.employeeId) return { dto: holderDto(current, t, true), created: false };
      throw reservationConflict({
        holderName: await repo.holderName(ctx.tx, current.holder_id),
        acquiredAt: current.acquired_at.toISOString(),
        leaseExpiresAt: current.lease_expires_at.toISOString(),
      });
    }
  }

  const leaseExpiresAt = leaseUntil(now, { idle: new Date(now.getTime() + t.idleMinutes * MIN), maxTotal: new Date(now.getTime() + t.maxTotalMinutes * MIN) }, t);
  const row = await repo.insertActive(ctx.tx, { businessId, holderId: principal.employeeId, now, leaseExpiresAt });
  if (!row) {
    // Lost the race on the partial unique index (the database is the arbiter).
    const winner = await repo.findActiveByBusiness(ctx.tx, businessId);
    if (winner && winner.holder_id === principal.employeeId) return { dto: holderDto(winner, t, true), created: false };
    throw reservationConflict(
      winner
        ? {
            holderName: await repo.holderName(ctx.tx, winner.holder_id),
            acquiredAt: winner.acquired_at.toISOString(),
            leaseExpiresAt: winner.lease_expires_at.toISOString(),
          }
        : undefined
    );
  }
  await audit(ctx, {
    eventName: 'contact_reservation.acquired',
    entityType: 'contact_reservation',
    entityId: row.id,
    payload: auditPayload(row),
    after: { state: 'active', leaseExpiresAt: row.lease_expires_at.toISOString() },
  });
  return { dto: holderDto(row, t, false), created: true };
}

export type RenewOutcome = { kind: 'ok'; dto: RenewResultDto } | { kind: 'lost'; reason: ReservationEndReason | 'token_mismatch' };

/**
 * R3-07 / R2-10 (server-trusted timers). "Keep working" may restart the max-total window at most
 * MAX_KEEP_WORKING_EXTENSIONS times, so no reservation outlives acquired_at + (1 + N) x maxTotalMinutes
 * whatever the client reports. `idleSeconds` stays advisory: it can only move activity forward, and a
 * heartbeat that arrives sooner than MIN_RENEW_INTERVAL_MS after the previous one credits nothing.
 */
export const MAX_KEEP_WORKING_EXTENSIONS = 2;
export const MIN_RENEW_INTERVAL_MS = 5_000;

/**
 * POST /api/reservations/:id/renew — heartbeat. A lost reservation is flipped to `expired` in this
 * transaction (committed), and the route then answers 409 RESERVATION_LOST.
 */
export async function renew(
  ctx: CommandContext,
  id: string,
  body: { leaseToken: string; idleSeconds: number; keepWorking: boolean }
): Promise<RenewOutcome> {
  const principal = principalOf(ctx);
  const now = clock.now();
  const row = await repo.findById(ctx.tx, id, true);
  if (!row) throw notFound();
  if (row.holder_id !== principal.employeeId || row.lease_token !== body.leaseToken) return { kind: 'lost', reason: 'token_mismatch' };
  if (row.state !== 'active') return { kind: 'lost', reason: row.end_reason ?? 'lease_elapsed' };
  const t = await loadTimings(ctx.tx);
  const lapsed = await expireIfLapsed(ctx, row, t, now);
  if (lapsed) return { kind: 'lost', reason: lapsed };
  // B7: access is re-checked on every renew, including for the assignee.
  const decision = await checkBusiness(ctx.tx, principal, 'reservation.renew', row.business_id);
  try {
    assertCallingAccess(decision);
  } catch {
    await endRow(ctx, row, 'expired', 'access_denied', now);
    return { kind: 'lost', reason: 'access_denied' };
  }
  const priorDeadlines = deadlines(row, t);
  const tooSoon = now.getTime() - row.last_renewed_at.getTime() < MIN_RENEW_INTERVAL_MS;
  const reported = new Date(now.getTime() - Math.max(0, body.idleSeconds) * 1000);
  const lastActivityAt = tooSoon ? row.last_activity_at : new Date(Math.max(row.last_activity_at.getTime(), reported.getTime()));
  let maxWindowStartedAt = row.max_window_started_at;
  const absoluteCap = row.acquired_at.getTime() + (1 + MAX_KEEP_WORKING_EXTENSIONS) * t.maxTotalMinutes * MIN;
  const mayExtend = now.getTime() + t.maxTotalMinutes * MIN <= absoluteCap + 1000;
  if (body.keepWorking && !tooSoon && mayExtend && now.getTime() >= priorDeadlines.maxTotalWarning.getTime()) {
    maxWindowStartedAt = now;
    await audit(ctx, {
      eventName: 'contact_reservation.extended',
      entityType: 'contact_reservation',
      entityId: row.id,
      after: { maxWindowStartedAt: maxWindowStartedAt.toISOString() },
    });
  }
  const d = deadlines({ last_activity_at: lastActivityAt, max_window_started_at: maxWindowStartedAt }, t);
  if (now.getTime() >= d.idle.getTime()) {
    await endRow(ctx, row, 'expired', 'idle', now);
    return { kind: 'lost', reason: 'idle' };
  }
  const updated = await repo.renew(ctx.tx, row.id, { now, lastActivityAt, maxWindowStartedAt, leaseExpiresAt: leaseUntil(now, d, t) });
  return { kind: 'ok', dto: renewDto(updated, t, now) };
}

/** POST /api/reservations/:id/release — holder only; repeat on an ended row is a no-op 200. */
export async function release(ctx: CommandContext, id: string, leaseToken: string): Promise<ReleaseResultDto> {
  const principal = principalOf(ctx);
  const row = await repo.findById(ctx.tx, id, true);
  if (!row) throw notFound();
  if (row.holder_id !== principal.employeeId || row.lease_token !== leaseToken) throw reservationLost('token_mismatch');
  if (row.state !== 'active') return { id: row.id, state: row.state, endReason: row.end_reason };
  const ended = await endRow(ctx, row, 'released', 'released', clock.now(), { endedBy: principal.employeeId });
  return { id: row.id, state: ended?.state ?? row.state, endReason: ended?.end_reason ?? row.end_reason };
}

/** POST /api/reservations/:id/override — Owner + 2FA, reason required (B3-Q14, DEC-004 SET). */
export async function override(ctx: CommandContext, id: string, reason: string): Promise<OverrideResultDto> {
  const principal = principalOf(ctx);
  const now = clock.now();
  const t = await loadTimings(ctx.tx);
  if (!t.ownerOverride) throw ruleViolation('Owner override is turned off in settings');
  const row = await repo.findById(ctx.tx, id, true);
  if (!row) throw notFound();
  assertAllowed(await checkBusiness(ctx.tx, principal, 'reservation.override', row.business_id));
  if (row.state === 'overridden') return { id: row.id, state: 'overridden', endedAt: row.ended_at!.toISOString() };
  if (row.state !== 'active' || (await expireIfLapsed(ctx, row, t, now))) {
    throw stateConflict('This reservation has already ended');
  }
  const ended = await endRow(ctx, row, 'overridden', 'overridden', now, { endedBy: principal.employeeId, overrideReason: reason });
  // B3-Q14 holder notice (DEMO, BL-03 / BE3-R1): ids only, in the same transaction as the audit row.
  await outbox.emit(ctx.tx, {
    name: 'contact_reservation.overridden',
    aggregateType: 'contact_reservation',
    aggregateId: row.id,
    payload: { businessId: row.business_id, holderId: row.holder_id },
  });
  return { id: row.id, state: 'overridden', endedAt: (ended?.ended_at ?? now).toISOString() };
}

// ---------------------------------------------------------------------------
// Public ops for MOD-calls / MOD-assignment
// ---------------------------------------------------------------------------

export type LeaseCheck =
  | { held: true; row: ReservationRow }
  | { held: false; reason: ReservationEndReason | 'token_mismatch' | 'not_found'; row: ReservationRow | null };

/**
 * Lock and validate the lease inside the caller's transaction (IC-15, design §6 step 3). A lapsed
 * row is flipped to `expired` here (audited once). Never throws for a lost lease: the caller applies
 * the save-after-loss flag.
 */
export async function validateLease(
  ctx: CommandContext,
  lease: { reservationId: string; leaseToken: string; businessId: string }
): Promise<LeaseCheck> {
  const principal = principalOf(ctx);
  const row = await repo.findById(ctx.tx, lease.reservationId, true);
  if (!row || row.business_id !== lease.businessId) return { held: false, reason: 'not_found', row: null };
  if (row.holder_id !== principal.employeeId || row.lease_token !== lease.leaseToken) {
    // Another user's row: never returned to the caller beyond its id.
    return { held: false, reason: 'token_mismatch', row: row.holder_id === principal.employeeId ? row : null };
  }
  if (row.state !== 'active') return { held: false, reason: row.end_reason ?? 'lease_elapsed', row };
  const t = await loadTimings(ctx.tx);
  const lapsed = await expireIfLapsed(ctx, row, t, clock.now());
  if (lapsed) return { held: false, reason: lapsed, row };
  return { held: true, row };
}

/** Post-commit step after a call save (AR-03): release with `call_saved`. Own transaction. */
export async function endAfterSave(ctx: CommandContext, reservationId: string): Promise<'released' | 'already_ended'> {
  const principal = principalOf(ctx);
  const row = await repo.findById(ctx.tx, reservationId, true);
  if (!row || row.holder_id !== principal.employeeId || row.state !== 'active') return 'already_ended';
  const ended = await endRow(ctx, row, 'released', 'call_saved', clock.now(), { endedBy: principal.employeeId });
  return ended ? 'released' : 'already_ended';
}

/**
 * U-01 (APPROVED: "Accepted keeps reservation"): after a save with keepReservation the lease is
 * renewed instead of released; idle activity is refreshed, max-total is not. Own transaction.
 */
export async function keepAfterSave(ctx: CommandContext, reservationId: string): Promise<RenewResultDto | null> {
  const principal = principalOf(ctx);
  const now = clock.now();
  const row = await repo.findById(ctx.tx, reservationId, true);
  if (!row || row.holder_id !== principal.employeeId || row.state !== 'active') return null;
  const t = await loadTimings(ctx.tx);
  if (await expireIfLapsed(ctx, row, t, now)) return null;
  const d = deadlines({ last_activity_at: now, max_window_started_at: row.max_window_started_at }, t);
  const updated = await repo.renew(ctx.tx, row.id, {
    now,
    lastActivityAt: now,
    maxWindowStartedAt: row.max_window_started_at,
    leaseExpiresAt: leaseUntil(now, d, t),
  });
  return renewDto(updated, t, now);
}

/** Read-only: the live Active reservation of a business (lapsed rows count as none). */
export async function activeFor(
  db: Queryable,
  businessId: string
): Promise<{ id: string; holderId: string; holderName: string; acquiredAt: Date; leaseExpiresAt: Date } | null> {
  const row = await repo.findActiveByBusiness(db, businessId);
  if (!row || clock.now().getTime() >= row.lease_expires_at.getTime()) return null;
  return {
    id: row.id,
    holderId: row.holder_id,
    holderName: await repo.holderName(db, row.holder_id),
    acquiredAt: row.acquired_at,
    leaseExpiresAt: row.lease_expires_at,
  };
}

/** J-05 `reservation.expiry_sweep` (housekeeping only; correctness never depends on it). */
export async function sweepExpired(ctx: CommandContext, limit = 200): Promise<number> {
  const now = clock.now();
  const t = await loadTimings(ctx.tx);
  const rows = await repo.lockLapsed(ctx.tx, now, limit);
  let n = 0;
  for (const row of rows) {
    const reason = lapseReason(row, t, now) ?? 'lease_elapsed';
    if (await endRow(ctx, row, 'expired', reason, now)) n++;
  }
  return n;
}

export const resolveReservationBusiness = repo.businessOf;

/** Read op for queue/list enrichment: businessId → live holder id. */
export async function liveHolders(db: Queryable, businessIds: readonly string[]): Promise<Map<string, string>> {
  return repo.liveHolders(db, businessIds, clock.now());
}
