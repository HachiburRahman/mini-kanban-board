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
    const message = typeof body.message === 'string' ? body.message : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const api = {
  register: (data: { email: string; password: string; name: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  listBoards: () => request<BoardSummary[]>('/boards'),

  createBoard: (data: { title: string }) =>
    request<BoardSummary>('/boards', { method: 'POST', body: JSON.stringify(data) }),

  getBoard: (id: string) => request<BoardDetail>(`/boards/${id}`),

  shareBoard: (id: string, email: string) =>
    request<BoardMember>(`/boards/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  removeBoardMember: (id: string, userId: string) =>
    request<{ success: boolean }>(`/boards/${id}/members/${userId}`, { method: 'DELETE' }),

  createColumn: (boardId: string, title: string) =>
    request<Column>(`/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify({ title }) }),

  createTask: (columnId: string, title: string) =>
    request<Task>(`/columns/${columnId}/tasks`, { method: 'POST', body: JSON.stringify({ title }) }),

  moveTask: (taskId: string, data: { columnId?: string; index: number }) =>
    request<Task>(`/tasks/${taskId}/move`, { method: 'POST', body: JSON.stringify(data) }),
};
