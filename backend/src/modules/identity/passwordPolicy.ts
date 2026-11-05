/**
 * New-password quality checks (review 2026-11-04 controls gap V6.2 / S-33 "breached-password refusal"). Pure.
 *
 * Offline only: nothing is sent anywhere. A new password is refused when
 *   1. it is, or is built from, a commonly used password (commonPasswords.ts): checked on the whole value and on
 *      its "core" (lower-cased, leading/trailing digits and symbols removed, common letter substitutions undone,
 *      separators removed), so "Password1234!", "P@ssw0rd-2026" or "qwertyuiop12" are refused;
 *   2. it is one repeated character, or a straight run of keyboard/alphabet/digit sequence;
 *   3. it contains the account's email local part (checked where the account is known: change and reset).
 * Length (PASSWORD_MIN_LENGTH, 12) and the 72-byte bcrypt limit stay in the shared schema (routes.ts).
 */
import { COMMON_PASSWORDS } from './commonPasswords.js';

export const COMMON_PASSWORD_MESSAGE = 'This password is too common or easy to guess. Choose a longer, less predictable passphrase.';
export const EMAIL_IN_PASSWORD_MESSAGE = 'The password must not contain your email name.';

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i', '|': 'l', '+': 't' };

const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1qaz2wsx3edc4rfv', 'qazwsxedcrfv'];

function isSequenceRun(s: string): boolean {
  if (s.length < 4) return false;
  for (const seq of SEQUENCES) {
    for (const src of [seq, [...seq].reverse().join('')]) {
      // s is made of one or more (possibly wrapped) runs of the same sequence.
      const doubled = src.repeat(4);
      let i = 0;
      let ok = true;
      while (i < s.length && ok) {
        const start = doubled.indexOf(s[i]);
        if (start < 0) {
          ok = false;
          break;
        }
        let j = 0;
        while (i + j < s.length && start + j < doubled.length && doubled[start + j] === s[i + j]) j++;
        if (j < 3) ok = false;
        i += j;
      }
      if (ok) return true;
    }
  }
  return false;
}

/** Lower-case, NFKC; then the "core" variants used for the common-password lookup. */
function variants(password: string): string[] {
  const lower = password.normalize('NFKC').toLowerCase().trim();
  const stripped = lower.replace(/^[^a-z]+/, '').replace(/[^a-z]+$/, '');
  const deleet = (x: string) => [...x].map((c) => LEET[c] ?? c).join('');
  const lettersOnly = (x: string) => x.replace(/[^a-z0-9]/g, '');
  const out = new Set<string>([lower, stripped, deleet(lower), deleet(stripped), lettersOnly(lower), lettersOnly(deleet(stripped))]);
  // "passwordpassword", "abc123abc123": a common value repeated.
  for (const v of [...out]) {
    for (let n = 1; n <= v.length / 2; n++) {
      if (v.length % n === 0 && v.slice(0, n).repeat(v.length / n) === v) {
        out.add(v.slice(0, n));
        break;
      }
    }
  }
  out.delete('');
  return [...out];
}

/** True when the password is a common password, a variant of one, a repeated character or a sequence run. */
export function isCommonPassword(password: string): boolean {
  const vs = variants(password);
  if (vs.some((v) => COMMON_PASSWORDS.has(v))) return true;
  const compact = password.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  if (/^(.)\1*$/.test(compact)) return true;
  return isSequenceRun(compact) || isSequenceRun(compact.replace(/[^a-z0-9]/g, ''));
}

/** True when the password contains the email's local part (3+ characters; separators ignored too). */
export function containsEmailName(password: string, email: string | null | undefined): boolean {
  if (!email) return false;
  const local = email.split('@')[0]?.normalize('NFKC').toLowerCase() ?? '';
  const pw = password.normalize('NFKC').toLowerCase();
  const compactLocal = local.replace(/[^a-z0-9]/g, '');
  const compactPw = pw.replace(/[^a-z0-9]/g, '');
  return (local.length >= 3 && pw.includes(local)) || (compactLocal.length >= 3 && compactPw.includes(compactLocal));
}
