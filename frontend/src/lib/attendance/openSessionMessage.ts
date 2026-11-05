/**
 * What an employee is told about an open session from an earlier day (DEC-011 / D5), by who fixes it.
 * S-30 (Owner 2026-11-05): the Owner never sends a correction request; they close their own session directly in
 * Attendance → Corrections & review (reason required, audited as a self-adjustment). Everyone else sends a request.
 */
export interface OpenSessionMessage {
  body: string;
  /** Owner only: where the session is closed. */
  action: { label: string; href: string } | null;
}

export function correctionsHref(sessionId: string): string {
  return `/attendance/corrections?session=${encodeURIComponent(sessionId)}`;
}

export function openSessionMessage(input: { ownerCorrectsDirectly: boolean; checkedInAt: string; sessionId: string }): OpenSessionMessage {
  const lead = `Checked in ${input.checkedInAt} with no checkout.`;
  if (input.ownerCorrectsDirectly) {
    return {
      body: `${lead} Close it yourself to unblock check-in: enter your checkout time and a reason. It is recorded in the audit log as a self-adjustment.`,
      action: { label: 'Close this session', href: correctionsHref(input.sessionId) },
    };
  }
  return { body: `${lead} Check-in stays blocked until you send a correction request with your checkout time.`, action: null };
}

/** Short line under the missing-checkout card. */
export function missingCheckoutHint(ownerCorrectsDirectly: boolean): string {
  return ownerCorrectsDirectly
    ? 'This session is flagged as a missing checkout. Close it yourself in Attendance → Corrections & review.'
    : 'This session is flagged as a missing checkout. Send a correction request with your checkout time from My Attendance.';
}
