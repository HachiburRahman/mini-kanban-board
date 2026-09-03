'use client';

import { type FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { BoardDetail, BoardMember } from '@/lib/types';

/**
 * Board sharing: shows who currently has access (owner + shared members) and,
 * for the owner only, lets them grant access to another registered user by
 * email or revoke it again. Non-owners see the roster but no controls - the
 * API enforces the same rule, this just avoids showing buttons that 403.
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
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onShare(e: FormEvent) {
    e.preventDefault();
    const target = email.trim();
    if (!target) return;

    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const member = await api.shareBoard(board.id, target);
      onMembersChanged([...board.members, member]);
      setEmail('');
      setNotice(`Shared with ${member.user.name}`);
    } catch (err) {
      // The API distinguishes "no such user" (404) from "already has access"
      // (409); both come back with a readable message, so just surface it.
      setError(err instanceof ApiError ? err.message : 'Could not share this board');
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
      setError(err instanceof ApiError ? err.message : 'Could not remove that member');
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">People with access</h2>

      <ul className="mb-4 space-y-2">
        <li className="flex items-center justify-between gap-3 text-sm">
          <span>
            {board.owner.name}{' '}
            <span className="text-slate-500">&lt;{board.owner.email}&gt;</span>
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Owner</span>
        </li>

        {board.members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              {member.user.name}{' '}
              <span className="text-slate-500">&lt;{member.user.email}&gt;</span>
            </span>
            {isOwner ? (
              <button
                onClick={() => onRemove(member)}
                className="text-xs text-red-600 underline"
                type="button"
              >
                Remove
              </button>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                Member
              </span>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={onShare} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Share with a registered user's email"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Sharing…' : 'Share'}
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-2 text-sm text-green-700">{notice}</p>}
    </section>
  );
}
