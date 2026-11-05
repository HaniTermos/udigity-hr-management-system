import { afterEach, describe, expect, it, vi } from 'vitest';
import { markSessionKnown, resetSessionEnded, signalSessionLost, useSessionEnded } from './sessionEndedSignal';
import { sessionEndReasonFor } from './sessionEndReason';

// signalSessionEnded needs a mounted listener; subscribe through the same store the hook uses.
import * as signal from './sessionEndedSignal';

afterEach(() => {
  vi.unstubAllGlobals();
  markSessionKnown(false);
  resetSessionEnded();
});

describe('signalSessionLost (A-01)', () => {
  it('does nothing for a visitor who never had a session', () => {
    vi.stubGlobal('window', { location: { pathname: '/businesses/new' } });
    markSessionKnown(false);
    expect(signalSessionLost('SESSION_EXPIRED')).toBe(false);
  });
  it('does nothing on public pages', () => {
    vi.stubGlobal('window', { location: { pathname: '/login' } });
    markSessionKnown(true);
    expect(signalSessionLost()).toBe(false);
  });
  it('maps codes to reasons', () => {
    expect(sessionEndReasonFor('SESSION_REVOKED')).toBe('revoked');
    expect(sessionEndReasonFor('ACCOUNT_DEACTIVATED')).toBe('deactivated');
    expect(sessionEndReasonFor(undefined)).toBe('expired');
  });
  it('exports the hook used by the shell', () => {
    expect(typeof useSessionEnded).toBe('function');
    expect(typeof signal.signalSessionEnded).toBe('function');
  });
});
