/** Why a session ended. Pure (no imports) so the API client, the signal and the error router can all use it. */
export type SessionEndReason = 'expired' | 'revoked' | 'deactivated';

export function sessionEndReasonFor(code: string | undefined): SessionEndReason {
  switch (code) {
    case 'ACCOUNT_DEACTIVATED':
    case 'ACCOUNT_INACTIVE':
      return 'deactivated';
    case 'SESSION_REVOKED':
    case 'SESSION_INVALID':
      return 'revoked';
    default:
      return 'expired';
  }
}
