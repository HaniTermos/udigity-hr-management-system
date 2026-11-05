import { describe, expect, it } from 'vitest';
import { correctionsHref, missingCheckoutHint, openSessionMessage } from './openSessionMessage';

describe('open session from an earlier day (S-30)', () => {
  it('tells the Owner to close it directly and links to that session in Corrections & review', () => {
    const m = openSessionMessage({ ownerCorrectsDirectly: true, checkedInAt: '08:10', sessionId: 'abc-1' });
    expect(m.body).toContain('Checked in 08:10 with no checkout.');
    expect(m.body).toContain('Close it yourself');
    expect(m.body).not.toMatch(/correction request/i);
    expect(m.action).toEqual({ label: 'Close this session', href: '/attendance/corrections?session=abc-1' });
    expect(missingCheckoutHint(true)).not.toMatch(/correction request/i);
  });

  it('keeps the request route for every other role', () => {
    const m = openSessionMessage({ ownerCorrectsDirectly: false, checkedInAt: '08:10', sessionId: 'abc-1' });
    expect(m.body).toBe('Checked in 08:10 with no checkout. Check-in stays blocked until you send a correction request with your checkout time.');
    expect(m.action).toBeNull();
    expect(missingCheckoutHint(false)).toMatch(/correction request/);
  });

  it('encodes the session id in the link', () => {
    expect(correctionsHref('a b')).toBe('/attendance/corrections?session=a%20b');
  });
});
