import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '../lib/api';
import { clearSession } from '../lib/auth';

function mockFetch(body: unknown = {}, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** The [url, method, parsed body] of the nth fetch call. */
function callOf(fetchMock: ReturnType<typeof mockFetch>, n = 0) {
  const [url, init] = fetchMock.mock.calls[n];
  return { url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
}

beforeEach(() => clearSession());
afterEach(() => vi.unstubAllGlobals());

describe('board write methods', () => {
  it('renames a board with PATCH', async () => {
    const fetchMock = mockFetch({ id: 'b1', title: 'Renamed' });
    await api.updateBoard('b1', { title: 'Renamed' });
    expect(callOf(fetchMock)).toEqual({
      url: 'http://localhost:4000/boards/b1',
      method: 'PATCH',
      body: { title: 'Renamed' },
    });
  });

  it('deletes a board with DELETE and no body', async () => {
    const fetchMock = mockFetch({ success: true });
    await api.deleteBoard('b1');
    expect(callOf(fetchMock)).toEqual({
      url: 'http://localhost:4000/boards/b1',
      method: 'DELETE',
      body: undefined,
    });
  });
});

describe('column write methods', () => {
  it('renames a column', async () => {
    const fetchMock = mockFetch({ id: 'c1' });
    await api.updateColumn('c1', { title: 'In review' });
    expect(callOf(fetchMock)).toEqual({
      url: 'http://localhost:4000/columns/c1',
      method: 'PATCH',
      body: { title: 'In review' },
    });
  });

  it('deletes a column', async () => {
    const fetchMock = mockFetch({ success: true });
    await api.deleteColumn('c1');
    expect(callOf(fetchMock).method).toBe('DELETE');
  });

  it('reorders a column through the move endpoint', async () => {
    const fetchMock = mockFetch({ id: 'c1' });
    await api.moveColumn('c1', { index: 2 });
    expect(callOf(fetchMock)).toEqual({
      url: 'http://localhost:4000/columns/c1/move',
      method: 'POST',
      body: { index: 2 },
    });
  });
});

describe('task write methods', () => {
  it('creates a task with a description when one is given', async () => {
    const fetchMock = mockFetch({ id: 't1' });
    await api.createTask('c1', { title: 'Ship it', description: 'and write it up' });
    expect(callOf(fetchMock)).toEqual({
      url: 'http://localhost:4000/columns/c1/tasks',
      method: 'POST',
      body: { title: 'Ship it', description: 'and write it up' },
    });
  });

  it('omits description entirely when there is none', async () => {
    const fetchMock = mockFetch({ id: 't1' });
    await api.createTask('c1', { title: 'Ship it' });
    expect(callOf(fetchMock).body).toEqual({ title: 'Ship it' });
  });

  it('edits a task title and description', async () => {
    const fetchMock = mockFetch({ id: 't1' });
    await api.updateTask('t1', { title: 'New', description: 'Body' });
    expect(callOf(fetchMock)).toEqual({
      url: 'http://localhost:4000/tasks/t1',
      method: 'PATCH',
      body: { title: 'New', description: 'Body' },
    });
  });

  it('deletes a task', async () => {
    const fetchMock = mockFetch({ success: true });
    await api.deleteTask('t1');
    expect(callOf(fetchMock)).toEqual({
      url: 'http://localhost:4000/tasks/t1',
      method: 'DELETE',
      body: undefined,
    });
  });

  it('sends columnId only when the task changes column', async () => {
    const fetchMock = mockFetch({ id: 't1' });
    await api.moveTask('t1', { index: 1 });
    await api.moveTask('t1', { columnId: 'c2', index: 0 });
    expect(callOf(fetchMock, 0).body).toEqual({ index: 1 });
    expect(callOf(fetchMock, 1).body).toEqual({ columnId: 'c2', index: 0 });
  });
});

describe('rate-limit responses', () => {
  it('turns a bare 429 into something a person can act on', async () => {
    mockFetch({}, 429);
    const err = await api.login({ email: 'a@b.dev', password: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(429);
    expect(err.message).toBe('Too many attempts. Wait a minute and try again.');
  });

  it('still prefers the server message when the 429 carries one', async () => {
    mockFetch({ message: 'ThrottlerException: Too Many Requests' }, 429);
    const err = await api.login({ email: 'a@b.dev', password: 'x' }).catch((e) => e);
    expect(err.message).toBe('ThrottlerException: Too Many Requests');
  });
});
