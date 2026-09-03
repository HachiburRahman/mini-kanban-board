import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '../lib/api';
import { saveSession, clearSession } from '../lib/auth';

function mockFetch(response: { ok: boolean; status: number; body?: unknown }) {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: () => Promise.resolve(response.body ?? {}),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api request headers', () => {
  it('omits the Authorization header when logged out', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, body: [] });

    await api.listBoards();

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('attaches the stored bearer token once a session exists', async () => {
    saveSession('tok-123', { id: 'u1' });
    const fetchMock = mockFetch({ ok: true, status: 200, body: [] });

    await api.listBoards();

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-123');
  });
});

describe('api error handling', () => {
  it('surfaces the server message so the UI can show it verbatim', async () => {
    mockFetch({ ok: false, status: 409, body: { message: 'An account with this email already exists' } });

    const err = await api
      .register({ email: 'a@b.com', password: 'hunter22', name: 'A' })
      .catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.message).toBe('An account with this email already exists');
  });

  it('falls back to a status message when the error body has no message', async () => {
    mockFetch({ ok: false, status: 500, body: {} });

    const err = await api.listBoards().catch((e) => e);

    expect(err.message).toBe('Request failed (500)');
  });

  it('does not choke on a 204 with an empty body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.reject(new Error('no body')),
      }),
    );

    await expect(api.removeBoardMember('b1', 'u2')).resolves.toBeUndefined();
  });
});

describe('session storage', () => {
  it('round-trips the token and clears it on logout', async () => {
    saveSession('tok-abc', { id: 'u1', email: 'a@b.com' });
    const fetchMock = mockFetch({ ok: true, status: 200, body: [] });

    await api.listBoards();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-abc');

    clearSession();
    await api.listBoards();
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
  });
});
