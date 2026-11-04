import { describe, expect, it } from 'vitest';
import { isRateLimited, parseRetryAfter, rateLimitMessage } from './rateLimit';

describe('rate limit wording', () => {
  it('recognises the backend code, the old code and a bare 429', () => {
    expect(isRateLimited(429)).toBe(true);
    expect(isRateLimited(200, 'RATE_LIMITED')).toBe(true);
    expect(isRateLimited(401, 'TOO_MANY_ATTEMPTS')).toBe(true);
    expect(isRateLimited(401, 'INVALID_CREDENTIALS')).toBe(false);
  });
  it('rounds the wait up to whole minutes', () => {
    expect(rateLimitMessage(300)).toBe('Too many attempts. Try again in 5 minutes.');
    expect(rateLimitMessage(61)).toBe('Too many attempts. Try again in 2 minutes.');
    expect(rateLimitMessage(60)).toBe('Too many attempts. Try again in 1 minute.');
    expect(rateLimitMessage(30)).toBe('Too many attempts. Try again in 30 seconds.');
    expect(rateLimitMessage(7200)).toBe('Too many attempts. Try again in 2 hours.');
  });
  it('falls back when there is no Retry-After', () => {
    expect(rateLimitMessage(undefined)).toBe('Too many attempts. Wait a few minutes and try again.');
    expect(rateLimitMessage(0, 'requests')).toBe('Too many requests. Wait a few minutes and try again.');
  });
  it('parses seconds and dates', () => {
    expect(parseRetryAfter('120')).toBe(120);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('nonsense')).toBeUndefined();
    const now = Date.parse('2026-11-04T10:00:00Z');
    expect(parseRetryAfter('Wed, 04 Nov 2026 10:05:00 GMT', now)).toBe(300);
  });
});
