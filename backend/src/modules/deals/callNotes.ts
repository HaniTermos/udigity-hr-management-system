/**
 * MOD-deals — D15 "Relevant call notes" read op (BE2, approved policy 2026-10-29). Separate file so the deal
 * routes/service stay with BE4; the route in routes.ts is a one-line include.
 *
 * D15: an accepted opportunity is the assigned Developer's and the Owner's. The Developer gets the call notes
 * the consultation needs (the accepting agent's notes, client needs, service interest) read-only. Gate: the
 * route's `deal.read` check (access engine), then `developerMayActOnDeal` (assigned Developer under DEC-005
 * `assigned`); the Owner always. Nothing else about the calls (agent identity, reservations) is returned.
 */
import type { Queryable } from '../../db/pool.js';
import type { Principal } from '../../shared/access.js';
import { notFound, permissionDenied } from '../../shared/errors.js';
import { listAttempts } from '../calls/repo.js';
import { developerMayActOnDeal, getDealSummary } from './service.js';

export interface RelevantCallNoteDto {
  attemptId: string;
  attemptedAt: string;
  outcome: string;
  notes: string | null;
  clientNeedsNote: string | null;
  serviceInterest: string | null;
}

/** Most recent first; attempts without any note text are left out. Bounded (the last 50 attempts). */
export async function relevantCallNotes(db: Queryable, principal: Principal, dealId: string): Promise<{ items: RelevantCallNoteDto[] }> {
  const deal = await getDealSummary(db, dealId);
  if (!deal) throw notFound();
  if (principal.role !== 'owner' && !developerMayActOnDeal(principal, deal)) throw permissionDenied();
  const attempts = await listAttempts(db, deal.businessId, 50);
  return {
    items: attempts
      .filter((a) => a.notes || a.client_needs_note || a.service_interest)
      .map((a) => ({
        attemptId: a.id,
        attemptedAt: new Date(a.attempted_at).toISOString(),
        outcome: a.outcome,
        notes: a.notes,
        clientNeedsNote: a.client_needs_note,
        serviceInterest: a.service_interest,
      })),
  };
}
