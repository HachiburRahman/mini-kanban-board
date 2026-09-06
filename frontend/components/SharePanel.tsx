'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { BoardDetail, BoardMember } from '@/lib/types';
import { Avatar } from './Avatar';

/**
 * Sharing lives in a popover off the board header rather than as a panel
 * above the columns. Who-has-access is reference information: it should be
 * one tap away, not occupying the top of the board on every visit.
 *
 * Non-owners still see the roster but get no controls, matching what the
 * API will actually allow.
 */
export function SharePanel({
  board,
  isOwner,
  onMembersChanged,
}: {
  board: BoardDetail;
  isOwner: boolean;
  onMembersChanged: (members: BoardMember[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const people = [board.owner, ...board.members.map((m) => m.user)];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  async function onShare(e: FormEvent) {
    e.preventDefault();
    const target = email.trim();
    if (!target || busy) return;

    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const member = await api.shareBoard(board.id, target);
      onMembersChanged([...board.members, member]);
      setEmail('');
      setNotice(`${member.user.name} now has access.`);
    } catch (err) {
      // The API separates "no such user" (404) from "already has access"
      // (409) and both carry a readable message, so surface it as-is.
      setError(err instanceof ApiError ? err.message : 'Could not share this board.');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(member: BoardMember) {
    setError(null);
    setNotice(null);
    try {
      await api.removeBoardMember(board.id, member.userId);
      onMembersChanged(board.members.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that member.');
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="btn btn-secondary gap-2.5 px-3"
      >
        <span className="flex -space-x-2">
          {people.slice(0, 3).map((p) => (
            <Avatar key={p.id} name={p.name} seed={p.id} size={22} />
          ))}
        </span>
        <span>
          {people.length > 3 ? `+${people.length - 3} ` : ''}
          Share
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Board access"
          className="animate-in fixed inset-x-3 top-20 z-40 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-pop)] sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[22rem]"
        >
          <h2 className="font-display text-base font-bold">People with access</h2>

          <ul className="mt-3 space-y-1">
            <li className="flex items-center gap-3 rounded-md px-1 py-1.5">
              <Avatar name={board.owner.name} seed={board.owner.id} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{board.owner.name}</span>
                <span className="block truncate text-sm text-ink-faint">{board.owner.email}</span>
              </span>
              <span className="flex-none rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-ink-soft">
                Owner
              </span>
            </li>

            {board.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 rounded-md px-1 py-1.5">
                <Avatar name={member.user.name} seed={member.user.id} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{member.user.name}</span>
                  <span className="block truncate text-sm text-ink-faint">{member.user.email}</span>
                </span>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => onRemove(member)}
                    aria-label={`Remove ${member.user.name}`}
                    className="grid h-11 w-11 flex-none place-items-center rounded-md text-ink-faint hover:bg-danger-tint hover:text-danger"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                      <path d="M7.7 6.3 10 8.6l2.3-2.3 1.4 1.4L11.4 10l2.3 2.3-1.4 1.4L10 11.4l-2.3 2.3-1.4-1.4L8.6 10 6.3 7.7z" />
                    </svg>
                  </button>
                ) : (
                  <span className="flex-none px-2 text-xs font-semibold text-ink-faint">Member</span>
                )}
              </li>
            ))}
          </ul>

          {isOwner && (
            <form onSubmit={onShare} className="mt-4 border-t border-line pt-4">
              <label htmlFor="share-email" className="label">
                Invite by email
              </label>
              <div className="flex gap-2">
                <input
                  id="share-email"
                  type="email"
                  required
                  className="input"
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" disabled={busy} className="btn btn-primary flex-none">
                  {busy ? 'Adding…' : 'Add'}
                </button>
              </div>
              <p className="mt-1.5 text-sm text-ink-faint">
                They need an account on this app already.
              </p>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-3 text-sm font-medium text-success">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
