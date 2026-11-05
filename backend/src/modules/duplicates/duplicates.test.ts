/**
 * MOD-duplicates unit tests (no DB). Owner: BE2. Approved D11 (docs/policy-baseline-2026-10-29.md): valid
 * numbers normalise to E.164; a country code never starts with 0; no assumed country code.
 */
import { describe, expect, it } from 'vitest';
import { normalizePhone } from './service.js';

describe('normalizePhone (D11 E.164)', () => {
  it('normalises a valid explicit country code; drops the national trunk 0', () => {
    expect(normalizePhone('+961', '03 123 456', '')).toEqual({ ok: true, phone: { normalized: '+9613123456', countryCode: '+961', number: '03 123 456' } });
    expect(normalizePhone('961', '71234567', '')).toMatchObject({ ok: true, phone: { normalized: '+96171234567' } });
    expect(normalizePhone('', '+961 71 234 567', '')).toMatchObject({ ok: true, phone: { normalized: '+96171234567' } });
  });

  it('rejects country codes starting with 0, all-zero placeholders and non-codes; never normalises them', () => {
    for (const cc of ['+000', '000', '0961', '+0', '+0044', 'abc', '+12345', '+9a']) {
      expect(normalizePhone(cc, '71234567', ''), cc).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(normalizePhone('', '+0961 71 234 567', '')).toEqual({ ok: false, reason: 'invalid' });
    expect(normalizePhone('', '000961 71 234 567', '')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('no explicit code and no Owner-set default → no_country_code (no assumed code); an invalid default is refused', () => {
    expect(normalizePhone('', '71234567', '')).toEqual({ ok: false, reason: 'no_country_code' });
    expect(normalizePhone(null, '71234567', '   ')).toEqual({ ok: false, reason: 'no_country_code' });
    expect(normalizePhone('', '71234567', '+000')).toEqual({ ok: false, reason: 'invalid' });
    expect(normalizePhone('', '71234567', '+961')).toMatchObject({ ok: true, phone: { normalized: '+96171234567', countryCode: '+961' } });
  });
});
