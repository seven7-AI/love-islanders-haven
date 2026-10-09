import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from './client';

const getSession = vi.fn();
const refreshSession = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: () => getSession(), refreshSession: () => refreshSession() } },
}));

const fetchMock = vi.fn();
const json = (status: number, body: unknown, contentType = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    getSession.mockResolvedValue({ data: { session: { access_token: 'old-token' } } });
    refreshSession.mockResolvedValue({ data: { session: { access_token: 'new-token' } } });
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends the access token and JSON body', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    await expect(apiFetch('/v1/thing', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer old-token');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('refreshes the session once on 401 and retries', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { status: 401, detail: 'Token expired' }))
      .mockResolvedValueOnce(json(200, { id: 'u1' }));
    await expect(apiFetch('/v1/me')).resolves.toEqual({ id: 'u1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new-token');
  });

  it('surfaces problem details as ApiError', async () => {
    fetchMock.mockResolvedValue(json(409, { status: 409, detail: 'Already exists', code: 'conflict' }, 'application/problem+json'));
    const error = await apiFetch('/v1/thing').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'Already exists', code: 'conflict' });
  });

  it('does not retry forever when the refresh does not help', async () => {
    fetchMock.mockResolvedValue(json(401, { status: 401, detail: 'Authentication required' }));
    await expect(apiFetch('/v1/me')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('handles non-JSON error bodies', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(apiFetch('/v1/me')).rejects.toMatchObject({ status: 502, message: 'Request failed (502)' });
  });
});
