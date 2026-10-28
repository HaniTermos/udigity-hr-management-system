import { describe, expect, it } from 'vitest';
import { LogAttemptBody, ListFollowUpsQuery } from './schemas.js';
import { AcquireReservationBody, RenewReservationBody } from '../reservation/schemas.js';
import { ReassignBody } from '../assignment/schemas.js';

const id = '3f2b8c1e-6d4a-4b7e-9a10-1c2d3e4f5a6b';
const base = { businessId: id, reservationId: id, leaseToken: id, stateVersion: 1 };

describe('calling schemas (Increment 2 drafts)', () => {
  it('needs_another_call requires exactly one of follow-up or marker (D2)', () => {
    expect(LogAttemptBody.safeParse({ ...base, outcome: 'needs_another_call' }).success).toBe(false);
    expect(LogAttemptBody.safeParse({ ...base, outcome: 'needs_another_call', callbackToBeScheduled: true }).success).toBe(true);
    expect(
      LogAttemptBody.safeParse({ ...base, outcome: 'needs_another_call', followUp: { scheduledFor: '2026-11-01T10:00:00Z' } }).success
    ).toBe(true);
    expect(
      LogAttemptBody.safeParse({
        ...base,
        outcome: 'needs_another_call',
        callbackToBeScheduled: true,
        followUp: { scheduledFor: '2026-11-01T10:00:00Z' },
      }).success
    ).toBe(false);
  });

  it('U-01: keepReservation is allowed for accepted, hidden only for rejected', () => {
    expect(LogAttemptBody.safeParse({ ...base, outcome: 'accepted', clientNeedsNote: 'wants a website', keepReservation: true }).success).toBe(true);
    expect(LogAttemptBody.safeParse({ ...base, outcome: 'on_hold', keepReservation: true }).success).toBe(true);
    expect(LogAttemptBody.safeParse({ ...base, outcome: 'rejected', rejectionReason: 'asked to stop', keepReservation: true }).success).toBe(false);
    expect(LogAttemptBody.safeParse({ ...base, outcome: 'rejected', rejectionReason: 'asked to stop' }).success).toBe(true);
  });

  it('rejects unknown keys and a client-supplied attempt time (B3-Q07)', () => {
    expect(LogAttemptBody.safeParse({ ...base, outcome: 'on_hold', attemptedAt: '2026-01-01T00:00:00Z' }).success).toBe(false);
    expect(AcquireReservationBody.safeParse({ businessId: id, extra: 1 }).success).toBe(false);
  });

  it('renew defaults and calendar range cap', () => {
    expect(RenewReservationBody.parse({ leaseToken: id })).toMatchObject({ idleSeconds: 0, keepWorking: false });
    expect(ListFollowUpsQuery.safeParse({ from: '2026-01-01T00:00:00Z', to: '2026-06-01T00:00:00Z' }).success).toBe(false);
    expect(ListFollowUpsQuery.safeParse({ from: '2026-01-01T00:00:00Z', to: '2026-01-31T00:00:00Z' }).success).toBe(true);
  });

  it('reassign needs an explicit choice shape per follow-up (B3-Q03)', () => {
    const ok = ReassignBody.safeParse({
      businessId: id, newAssigneeId: id, version: 1, reason: 'agent left',
      followUps: [{ followUpId: id, action: 'transfer' }],
    });
    expect(ok.success).toBe(true);
    const bad = ReassignBody.safeParse({
      businessId: id, newAssigneeId: id, version: 1, reason: 'agent left',
      followUps: [{ followUpId: id, action: 'cancel' }],
    });
    expect(bad.success).toBe(false);
  });
});
