import { ApiError } from '@/lib/api/client';
import { rateLimitMessage } from '@/lib/api/rateLimit';

/** Plain-language text for a failed save. Field-level 400s are mapped to the form rows, not shown here. */
export function describeSaveError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  switch (err.code) {
    case 'POLICY_NOT_CONFIGURED':
      return 'A phone number has no country code and the company default country code is not set. Choose a country code for each phone.';
    case 'RATE_LIMITED':
      return rateLimitMessage(err.retryAfterSeconds, 'requests');
    case 'NETWORK_ERROR':
    case 'OFFLINE':
      // lib/api/offline.ts: "Not saved … your input is kept … try again when your connection returns".
      return err.message || 'We could not reach the server. Your entries are kept; try again.';
    case 'STATE_CONFLICT':
      return err.message || 'This record changed state, so the save was refused. Reload and try again.';
    case 'VALIDATION_ERROR':
      return 'Some fields need attention. They are marked below.';
    default:
      return err.message || fallback;
  }
}
