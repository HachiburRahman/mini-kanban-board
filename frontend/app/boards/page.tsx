'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { getStoredUser, getToken } from '@/lib/auth';
import { clearSession } from '@/lib/auth';
import type { AuthUser, BoardSummary } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';

export default function BoardsPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setMe(getStoredUser<AuthUser>());
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setBoards(await api.listBoards());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace('/login');
        return;
      }
      setError('Could not load your boards. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const board = await api.createBoard({ title: title.trim() });
      setTitle('');
      setBoards((prev) => [board, ...prev]);
    } catch {
      setError('Could not create that board. Try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
        <div className="mb-7 sm:mb-9">
          <h1 className="font-display text-[1.75rem] font-bold sm:text-[2.125rem]">Your boards</h1>
          <p className="mt-1.5 text-ink-soft">
            Boards you own, plus any that have been shared with you.
          </p>
        </div>

        {/* Create: a labelled field and a real button, not a bare input that
            only responds to Enter. */}
        <form
          onSubmit={onCreate}
          className="mb-8 flex flex-col gap-2.5 sm:mb-10 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="board-title" className="label">
              New board
            </label>
            <input
              id="board-title"
              className="input"
              placeholder="Q3 Roadmap"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={!title.trim() || creating}
            className="btn btn-primary sm:w-auto"
          >
            {creating ? 'Creating…' : 'Create board'}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mb-6 rounded-md border border-danger/25 bg-danger-tint px-3 py-2.5 text-sm font-medium text-danger"
          >
            {error}
          </p>
        )}

        {loading ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="card h-[7.5rem] animate-pulse bg-sunken" />
            ))}
          </ul>
        ) : boards.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <li key={board.id}>
                <Link
                  href={`/boards/${board.id}`}
                  className="card group flex h-full min-h-[7.5rem] flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-raised)]"
                >
                  <h2 className="font-display text-lg font-bold text-balance group-hover:text-accent">
                    {board.title}
                  </h2>
                  <span className="mt-4 text-sm text-ink-faint">
                    {me && board.ownerId === me.id ? 'Owned by you' : 'Shared with you'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className="h-12 w-12 text-line-strong"
        fill="currentColor"
      >
        <rect x="4" y="8" width="11" height="32" rx="2.5" />
        <rect x="18.5" y="8" width="11" height="21" rx="2.5" />
        <rect x="33" y="8" width="11" height="27" rx="2.5" />
      </svg>
      <h2 className="mt-5 font-display text-xl font-bold">No boards yet</h2>
      <p className="mt-2 max-w-sm text-ink-soft">
        Name a board above and it will show up here. Columns and cards come next.
      </p>
    </div>
  );
}
