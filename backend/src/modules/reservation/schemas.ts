/**
 * MOD-reservation — Zod request schemas (.strict()), response DTOs and VT-3 action declarations. Owner: BE3.
 * Status: Increment 4 (implemented). Action names and roles come from docs/security/authz-matrix.md §3.7 (BE2-C1 harness).
 * Contract: docs/implementation/plan.md section 4.1 (/api/reservations); design: docs/implementation/calling-design.md.
 * Timing values come from the policy registry (reservation.*, DEC-004 "Demonstration alternative — not approved").
 */
import { z } from 'zod';
import { safeString } from '../../shared/validation.js';
import { defineMatrixActions } from '../access/schemas.js';

/** authz-matrix §3.7: acquire/renew/release = Owner + Call Center (Asg, B7); override = Owner admin. */
export const ACTIONS = defineMatrixActions([
  'reservation.acquire',
  'reservation.renew',
  'reservation.release',
  'reservation.override',
] as const);

const uuid = safeString().uuid();
const reason = safeString().trim().min(3).max(500);

export const ReservationIdParam = z.object({ id: uuid }).strict();

/** POST /api/reservations — `Idempotency-Key` header required. */
export const AcquireReservationBody = z.object({ businessId: uuid }).strict();

/**
 * POST /api/reservations/:id/renew (heartbeat, every reservation.heartbeatSeconds while the workspace is open).
 * `idleSeconds` = seconds since the last user input on the client (tab blur is NOT idle). `keepWorking: true` is the explicit
 * action that restarts the max-total window (only honoured after the "max total" warning is shown).
 */
export const RenewReservationBody = z
  .object({
    leaseToken: uuid,
    idleSeconds: z.number().int().min(0).max(24 * 3600).default(0),
    keepWorking: z.boolean().default(false),
  })
  .strict();

/** POST /api/reservations/:id/release */
export const ReleaseReservationBody = z.object({ leaseToken: uuid }).strict();

/** POST /api/reservations/:id/override (Owner, 2FA) */
export const OverrideReservationBody = z.object({ reason }).strict();

export type { ReservationState, ReservationEndReason } from './repo.js';
import type { ReservationState, ReservationEndReason } from './repo.js';

/** Returned only to the holder (carries the lease token). */
export interface ReservationHolderDto {
  id: string;
  businessId: string;
  state: 'active';
  leaseToken: string;
  acquiredAt: string;
  leaseExpiresAt: string;
  /** now + idle window; the client shows "Expiring" from `idleWarningAt`. */
  idleExpiresAt: string;
  idleWarningAt: string;
  maxTotalExpiresAt: string;
  heartbeatSeconds: number;
  /** true when the same holder re-entered and the existing row was returned (second tab/device). */
  reentry: boolean;
}

/** Shown to anyone with business access when someone else holds the contact (409 RESERVATION_CONFLICT details). */
export interface ReservationConflictDetails {
  holderName: string;
  acquiredAt: string;
  leaseExpiresAt: string;
}

export interface RenewResultDto {
  id: string;
  state: 'active';
  leaseExpiresAt: string;
  idleExpiresAt: string;
  idleWarningAt: string;
  idleWarning: boolean;
  maxTotalExpiresAt: string;
  /** true from (maxTotalExpiresAt - (idleMinutes - idleWarningMinutes)); the UI then offers "Keep working". */
  maxTotalWarning: boolean;
  heartbeatSeconds: number;
}

/** 409 RESERVATION_LOST details. */
export interface ReservationLostDetails {
  reason: ReservationEndReason | 'token_mismatch';
}

export interface ReleaseResultDto {
  id: string;
  state: ReservationState;
  endReason: ReservationEndReason | null;
}

export interface OverrideResultDto {
  id: string;
  state: 'overridden';
  endedAt: string;
}

/** Owner list item for SCR-OWN-007 ("reserved by"). Holder visible only to users with business access. */
export interface ActiveReservationSummary {
  id: string;
  businessId: string;
  holderId: string;
  holderName: string;
  acquiredAt: string;
  leaseExpiresAt: string;
}
