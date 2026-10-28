import type { PhoneNumber, SocialAccount } from '@/lib/api/businesses';

/**
 * Display helpers for the Data Entry screens.
 * TODO(FE1 `useCompanyTime`, plan §9): render datetimes in the company timezone from settings. Until that hook
 * ships, datetimes render in UTC and `IsoDate` values (no time) are never timezone-shifted.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

function parts(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return { d: d.getUTCDate(), m: MONTHS[d.getUTCMonth()], y: d.getUTCFullYear(), hh: pad(d.getUTCHours()), mm: pad(d.getUTCMinutes()) };
}

/** `2 Oct 2026` */
export function formatDay(iso: string): string {
  const p = parts(iso);
  return `${p.d} ${p.m} ${p.y}`;
}

/** `6 Oct` */
export function formatDayShort(iso: string): string {
  const p = parts(iso);
  return `${p.d} ${p.m}`;
}

/** `21 Oct 2026, 09:40` */
export function formatDateTime(iso: string): string {
  const p = parts(iso);
  return `${p.d} ${p.m} ${p.y}, ${p.hh}:${p.mm}`;
}

/** `19 Oct, 14:20` */
export function formatDateTimeShort(iso: string): string {
  const p = parts(iso);
  return `${p.d} ${p.m}, ${p.hh}:${p.mm}`;
}

/** `3 h`, `1 day`, `4 days` */
export function formatAge(iso: string, now: number = Date.now()): string {
  const hours = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000));
  if (hours < 24) return `${Math.max(1, hours)} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

export const formatPhone = (p: PhoneNumber): string => `${p.countryCode} ${p.number}`;

/** `12,350` or `Unknown`. Unknown is never rendered as 0. */
export const formatFollowers = (n: number | null): string => (n === null ? 'Unknown' : n.toLocaleString('en-US'));

/** `Instagram · 12,350 followers` or `Facebook · followers unknown`. */
export function socialSecondLine(account: SocialAccount): string {
  return account.followers === null ? `${account.platform} · followers unknown` : `${account.platform} · ${formatFollowers(account.followers)} followers`;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}
