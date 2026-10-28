import { describe, expect, it } from 'vitest';
import { safeRedirectTarget } from './authRoutes';

const FALLBACK = '/my-day';

describe('safeRedirectTarget (CR1-04)', () => {
  it('keeps same-origin relative paths, with query and hash', () => {
    expect(safeRedirectTarget('/deals', FALLBACK)).toBe('/deals');
    expect(safeRedirectTarget('/businesses?q=gym&page=2', FALLBACK)).toBe('/businesses?q=gym&page=2');
    expect(safeRedirectTarget('/projects/abc#tasks', FALLBACK)).toBe('/projects/abc#tasks');
  });

  it('falls back for empty, absolute and protocol-relative values', () => {
    for (const bad of [null, undefined, '', 'deals', 'https://evil.example', 'http://evil.example/x', '//evil.example', '///evil.example', 'javascript:alert(1)']) {
      expect(safeRedirectTarget(bad, FALLBACK)).toBe(FALLBACK);
    }
  });

  it('rejects control characters that the URL parser strips (tab, newline, CR)', () => {
    expect(safeRedirectTarget('/\t/evil.example', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/\n/evil.example', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/\r/evil.example', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/\u0000/evil.example', FALLBACK)).toBe(FALLBACK);
  });

  it('rejects percent-encoded tab, newline, backslash and slash tricks', () => {
    expect(safeRedirectTarget('/%09/evil.example', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/%0a/evil.example', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/%5cevil.example', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/%5Cevil.example', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/%2f/evil.example', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/%2F%2Fevil.example', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/%zz', FALLBACK)).toBe(FALLBACK);
  });

  it('rejects backslashes', () => {
    expect(safeRedirectTarget('/\\evil.example', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/a\\b', FALLBACK)).toBe(FALLBACK);
  });

  it('never redirects back to a public auth page', () => {
    expect(safeRedirectTarget('/login', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/login?step=2fa', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectTarget('/session-ended', FALLBACK)).toBe(FALLBACK);
  });
});
