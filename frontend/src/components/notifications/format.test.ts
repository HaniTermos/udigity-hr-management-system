import { describe, expect, it } from 'vitest';
import { notificationIcon, relativeTime, safeLink } from './format';

describe('notification format helpers', () => {
  const now = new Date('2026-10-29T12:00:00Z');

  it('relativeTime', () => {
    expect(relativeTime('2026-10-29T11:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-10-29T11:59:00Z', now)).toBe('1 minute ago');
    expect(relativeTime('2026-10-29T11:15:00Z', now)).toBe('45 minutes ago');
    expect(relativeTime('2026-10-29T11:00:00Z', now)).toBe('1 hour ago');
    expect(relativeTime('2026-10-29T02:00:00Z', now)).toBe('10 hours ago');
    expect(relativeTime('2026-10-28T10:00:00Z', now)).toBe('yesterday');
    expect(relativeTime('2026-10-25T10:00:00Z', now)).toBe('4 days ago');
    expect(relativeTime('not a date', now)).toBe('');
  });

  it('safeLink keeps app paths only', () => {
    expect(safeLink('/deals/abc')).toBe('/deals/abc');
    expect(safeLink('https://evil.test/')).toBeNull();
    expect(safeLink('//evil.test')).toBeNull();
    expect(safeLink('/\\evil.test')).toBeNull();
    expect(safeLink(undefined)).toBeNull();
  });

  it('notificationIcon', () => {
    expect(notificationIcon('business.meeting_reminder')).toBe('calendar');
    expect(notificationIcon('business.follow_up_overdue')).toBe('clock');
    expect(notificationIcon('security.recovery_code_used')).toBe('shield');
    expect(notificationIcon('business.developer_handoff')).toBe('briefcase');
    expect(notificationIcon('something.else')).toBe('bell');
  });
});
