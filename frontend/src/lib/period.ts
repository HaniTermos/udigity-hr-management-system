export type TargetPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

/** Last day (YYYY-MM-DD) of a target period that starts on `start` (YYYY-MM-DD). Pure calendar arithmetic. */
export function periodEnd(start: string, period: TargetPeriod): string {
  const [y, m, d] = start.split('-').map(Number);
  const utc = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd)).toISOString().slice(0, 10);
  if (period === 'daily') return start;
  if (period === 'weekly') return utc(y, m - 1, d + 6);
  if (period === 'monthly') return utc(y, m, 0);
  return utc(y, Math.floor((m - 1) / 3) * 3 + 3, 0);
}
