// Regression: ISSUE-001 — every ValidationPipe error rendered as "Request failed (400)"
// Found by /qa on 2026-09-03
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-09-03.md
//
// Nest returns `message` as a string[] for anything ValidationPipe rejects. The
// client only handled the string form, so the real reason was discarded and the
// user saw a bare status code on every form in the app.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, ApiError } from '../lib/api';

function mockJson(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ISSUE-001: validation error arrays', () => {
  it('surfaces a single ValidationPipe message instead of the status code', async () => {
    mockJson(400, {
      message: ['Password must be at least 6 characters'],
      error: 'Bad Request',
      statusCode: 400,
    });

    const err = await api
      .register({ email: 'a@b.com', password: '123', name: 'A' })
      .catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Password must be at least 6 characters.');
    expect(err.message).not.toContain('Request failed');
  });

  it('joins multiple field errors into one readable sentence', async () => {
    // The empty-login case: Nest returns one entry per failing field.
    mockJson(400, {
      message: ['email must be an email', 'password must be a string'],
      statusCode: 400,
    });

    const err = await api.login({ email: '', password: '' }).catch((e) => e);

    expect(err.message).toBe('email must be an email. password must be a string.');
  });

  it('still passes through a plain string message untouched', async () => {
    mockJson(401, { message: 'Invalid email or password', statusCode: 401 });

    const err = await api.login({ email: 'a@b.com', password: 'nope' }).catch((e) => e);

    expect(err.message).toBe('Invalid email or password');
  });

  it('falls back to the status code when the array holds nothing usable', async () => {
    mockJson(400, { message: [] });

    const err = await api.listBoards().catch((e) => e);

    expect(err.message).toBe('Request failed (400)');
  });

  it('falls back when the array holds non-strings', async () => {
    mockJson(400, { message: [{ constraints: 'nope' }] });

    const err = await api.listBoards().catch((e) => e);

    expect(err.message).toBe('Request failed (400)');
  });

  it('falls back when the error body is empty or unparseable', async () => {
    mockJson(500, {});

    const err = await api.listBoards().catch((e) => e);

    expect(err.message).toBe('Request failed (500)');
  });

  it('ignores a blank string message rather than showing an empty alert', async () => {
    mockJson(400, { message: '   ' });

    const err = await api.listBoards().catch((e) => e);

    expect(err.message).toBe('Request failed (400)');
  });

  it('does not double up punctuation when the message already ends in a period', async () => {
    mockJson(400, { message: ['Title is too long.'] });

    const err = await api.listBoards().catch((e) => e);

    expect(err.message).toBe('Title is too long.');
  });
});
