import { getToken } from './auth';
import type { AuthResponse, BoardDetail, BoardMember, BoardSummary, Column, Task } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Pulls a human-readable reason out of a Nest error body.
 *
 * Nest sends `message` two different ways: a plain string for errors we throw
 * ourselves (`Invalid email or password`), and a string ARRAY for anything
 * ValidationPipe rejects (`["Password must be at least 6 characters"]`). Only
 * handling the string case meant every field-validation failure in the app
 * surfaced as a bare status code, throwing away the exact reason the API had
 * already worked out.
 */
function errorMessage(body: unknown, status: number): string {
  const raw = (body as { message?: unknown } | null)?.message;

  if (Array.isArray(raw)) {
    const parts = raw.filter((m): m is string => typeof m === 'string' && m.trim() !== '');
    if (parts.length > 0) {
      // Sentence-case the join so "email must be an email, password should not
      // be empty" reads as one message rather than a debug dump.
      return parts.join('. ').replace(/\.?$/, '.');
    }
  }

  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw;
  }

  // The rate limiter answers 429 with its own terse body; say something a
  // person can act on instead.
  if (status === 429) {
    return 'Too many attempts. Wait a minute and try again.';
  }

  return `Request failed (${status})`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorMessage(body, res.status));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const patch = (body: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) });
const del: RequestInit = { method: 'DELETE' };

export const api = {
  register: (data: { email: string; password: string; name: string }) =>
    request<AuthResponse>('/auth/register', post(data)),

  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', post(data)),

  // --- boards ---
  listBoards: () => request<BoardSummary[]>('/boards'),

  createBoard: (data: { title: string }) => request<BoardSummary>('/boards', post(data)),

  getBoard: (id: string) => request<BoardDetail>(`/boards/${id}`),

  updateBoard: (id: string, data: { title: string }) =>
    request<BoardSummary>(`/boards/${id}`, patch(data)),

  deleteBoard: (id: string) => request<{ success: boolean }>(`/boards/${id}`, del),

  shareBoard: (id: string, email: string) =>
    request<BoardMember>(`/boards/${id}/share`, post({ email })),

  removeBoardMember: (id: string, userId: string) =>
    request<{ success: boolean }>(`/boards/${id}/members/${userId}`, del),

  // --- columns ---
  createColumn: (boardId: string, title: string) =>
    request<Column>(`/boards/${boardId}/columns`, post({ title })),

  updateColumn: (columnId: string, data: { title: string }) =>
    request<Column>(`/columns/${columnId}`, patch(data)),

  deleteColumn: (columnId: string) => request<{ success: boolean }>(`/columns/${columnId}`, del),

  moveColumn: (columnId: string, data: { index: number }) =>
    request<Column>(`/columns/${columnId}/move`, post(data)),

  // --- tasks ---
  createTask: (columnId: string, data: { title: string; description?: string }) =>
    request<Task>(`/columns/${columnId}/tasks`, post(data)),

  updateTask: (taskId: string, data: { title?: string; description?: string }) =>
    request<Task>(`/tasks/${taskId}`, patch(data)),

  deleteTask: (taskId: string) => request<{ success: boolean }>(`/tasks/${taskId}`, del),

  moveTask: (taskId: string, data: { columnId?: string; index: number }) =>
    request<Task>(`/tasks/${taskId}/move`, post(data)),
};
