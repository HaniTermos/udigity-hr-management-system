/** Mirrors the backend PASSWORD_MIN_LENGTH (default 12). One place for the reset form and the profile form. */
export const PASSWORD_MIN_LENGTH = Number(process.env.NEXT_PUBLIC_PASSWORD_MIN_LENGTH || 12);

/** Backend codes (and aliases) for a password refused as common or found in a breach list (review SEC, ASVS V6). */
const REFUSED_CODES = new Set([
  'PASSWORD_BREACHED',
  'PASSWORD_COMMON',
  'PASSWORD_TOO_COMMON',
  'PASSWORD_PWNED',
  'PASSWORD_POLICY',
  'PASSWORD_REFUSED',
  'WEAK_PASSWORD',
]);

export const PASSWORD_REFUSED_MESSAGE =
  'This password is too common or has appeared in a data breach. Choose a longer, less predictable one.';

/**
 * Message for a 400 on a password field, or null when the failure is not about the password rules.
 * `fieldErrors` may carry the server wording (`newPassword`/`password`); it is shown when present.
 */
export function passwordRuleMessage(
  err: { code?: string; status?: number; message?: string; fieldErrors?: Record<string, string[]> } | null | undefined
): string | null {
  if (!err) return null;
  const field = err.fieldErrors?.newPassword?.[0] ?? err.fieldErrors?.password?.[0];
  if (err.code && REFUSED_CODES.has(err.code)) return field ?? PASSWORD_REFUSED_MESSAGE;
  if (err.code === 'VALIDATION_ERROR' || err.status === 400) {
    return field ?? `The new password does not meet the rules (at least ${PASSWORD_MIN_LENGTH} characters, not a common or breached password).`;
  }
  return null;
}
