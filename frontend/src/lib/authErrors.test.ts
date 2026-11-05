import { describe, expect, it } from 'vitest';
import { authFailureText, SERVER_TROUBLE_TEXT } from './authErrors';
import { ApiError } from '@/lib/api/client';
import { classifyError } from '@/lib/errorRouting';

describe('authFailureText', () => {
  it('says how long to wait on a rate limit', () => {
    const r = authFailureText({ status: 429, error: { code: 'RATE_LIMITED', retryAfterSeconds: 600 } }, 'Email or password is incorrect.');
    expect(r).toEqual({ text: 'Too many attempts. Try again in 10 minutes.', code: 'RATE_LIMITED' });
  });
  it('treats an nginx 429 without a code as a rate limit', () => {
    expect(authFailureText({ status: 429, error: {} }, 'x').code).toBe('RATE_LIMITED');
  });
  it('does not blame the password when the network or server fails', () => {
    expect(authFailureText({ status: 0, error: { code: 'NETWORK_ERROR' } }, 'wrong').text).toBe(SERVER_TROUBLE_TEXT);
    expect(authFailureText({ status: 503, error: null }, 'wrong').text).toBe(SERVER_TROUBLE_TEXT);
  });
  it('keeps the neutral wording for a wrong password', () => {
    expect(authFailureText({ status: 401, error: { code: 'INVALID_CREDENTIALS' } }, 'Email or password is incorrect.')).toEqual({
      text: 'Email or password is incorrect.',
      code: 'INVALID_CREDENTIALS',
    });
  });
});

describe('rate-limited route', () => {
  it('carries Retry-After into the error route', () => {
    const e = new ApiError(429, { error: 'slow down', code: 'RATE_LIMITED', retryAfterSeconds: 120 });
    expect(classifyError(e)).toEqual({ kind: 'rate-limited', retryAfterSeconds: 120 });
  });
});
