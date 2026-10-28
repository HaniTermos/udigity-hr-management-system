import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './http';
import { api, ApiError } from './client';
import {
  CONNECTION_LOST_MESSAGE,
  OFFLINE_NOT_SENT_MESSAGE,
  browserIsOffline,
  isMutatingMethod,
  networkFailure,
  offlineBlock,
} from './offline';
import { classifyError, offlineSaveMessage } from '@/lib/errorRouting';

/** UDI-18 / SCR-SHR-015: saves are not sent while offline; a dropped save says "not saved"; reads still go. */

function stubNetwork({ online, fetchImpl }: { online: boolean; fetchImpl?: () => Promise<Response> }) {
  vi.stubGlobal('navigator', { onLine: online });
  const fetchMock = vi.fn(fetchImpl ?? (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offline guard (pure)', () => {
  it('treats POST/PUT/PATCH/DELETE as mutations, any case; GET and a missing method are reads', () => {
    for (const m of ['POST', 'put', 'Patch', 'DELETE']) expect(isMutatingMethod(m)).toBe(true);
    for (const m of ['GET', 'get', 'HEAD', undefined]) expect(isMutatingMethod(m)).toBe(false);
  });

  it('reports offline only when navigator.onLine is exactly false', () => {
    expect(browserIsOffline({ onLine: false })).toBe(true);
    expect(browserIsOffline({ onLine: true })).toBe(false);
    expect(browserIsOffline({})).toBe(false);
    expect(browserIsOffline(undefined)).toBe(false);
  });

  it('blocks mutations while offline and never blocks reads', () => {
    expect(offlineBlock('POST', true)).toEqual({ error: OFFLINE_NOT_SENT_MESSAGE, code: 'OFFLINE' });
    expect(offlineBlock('DELETE', true)?.code).toBe('OFFLINE');
    expect(offlineBlock('GET', true)).toBeNull();
    expect(offlineBlock('POST', false)).toBeNull();
  });

  it('a failed save says "not saved"; a failed read keeps the plain network error', () => {
    expect(networkFailure('PATCH')).toEqual({ error: CONNECTION_LOST_MESSAGE, code: 'NETWORK_ERROR' });
    expect(networkFailure('GET')).toEqual({ error: 'Network error', code: 'NETWORK_ERROR' });
  });
});

describe('apiFetch offline behaviour', () => {
  it('does not send a mutation while offline', async () => {
    const fetchMock = stubNetwork({ online: false });
    const res = await apiFetch('/api/businesses', { method: 'POST', body: { name: 'x' } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: false, status: 0, error: { code: 'OFFLINE', error: OFFLINE_NOT_SENT_MESSAGE } });
  });

  it('still sends reads while offline (the browser decides; cached or captive networks may answer)', async () => {
    const fetchMock = stubNetwork({ online: false });
    const res = await apiFetch('/api/businesses');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
  });

  it('sends mutations normally when online', async () => {
    const fetchMock = stubNetwork({ online: true });
    const res = await apiFetch('/api/businesses', { method: 'PATCH', body: { version: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
  });

  it('a connection drop during a save returns the "not saved" message, once (no automatic retry)', async () => {
    const fetchMock = stubNetwork({ online: true, fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')) });
    const res = await apiFetch('/api/businesses', { method: 'POST', body: {} });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ ok: false, status: 0, error: { code: 'NETWORK_ERROR', error: CONNECTION_LOST_MESSAGE } });
  });
});

describe('typed client + error routing', () => {
  it('api.post offline throws an ApiError routed to "offline" with the not-sent copy', async () => {
    stubNetwork({ online: false });
    const err = await api.post('/api/categories', { name: 'x' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe(OFFLINE_NOT_SENT_MESSAGE);
    expect(classifyError(err)).toEqual({ kind: 'offline' });
    expect(offlineSaveMessage(err)).toBe(OFFLINE_NOT_SENT_MESSAGE);
  });

  it('a dropped save is routed to "offline" with the connection-lost copy', async () => {
    stubNetwork({ online: true, fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')) });
    const err = await api.patch('/api/categories/1', { name: 'x', version: 1 }).catch((e: unknown) => e);
    expect((err as ApiError).message).toBe(CONNECTION_LOST_MESSAGE);
    expect(offlineSaveMessage(err)).toBe(CONNECTION_LOST_MESSAGE);
  });

  it('offlineSaveMessage is null for failures that are not about the connection', () => {
    expect(offlineSaveMessage(new ApiError(500, { error: 'boom', code: 'INTERNAL_ERROR' }))).toBeNull();
    expect(offlineSaveMessage(new ApiError(403, { error: 'no', code: 'FORBIDDEN_ROLE' }))).toBeNull();
  });
});
