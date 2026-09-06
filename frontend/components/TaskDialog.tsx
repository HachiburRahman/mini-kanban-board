'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import type { Task } from '@/lib/types';
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '@/lib/validation';

/**
 * Edit a card: title, description, or delete it.
 *
 * A card used to be read-only once created - the API had PATCH and DELETE for
 * tasks from the start, and nothing in the UI called them, so a description
 * could be rendered but never written.
 */
export function TaskDialog({
  task,
  columnTitle,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task;
  columnTitle: string;
  onSave: (data: { title: string; description: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      // Keep Tab inside the dialog while it is open.
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, input, [href]',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmedTitle = title.trim();
  const tooLong = trimmedTitle.length > TITLE_MAX_LENGTH || description.length > DESCRIPTION_MAX_LENGTH;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmedTitle || busy || tooLong) return;
    setError(null);
    setBusy('save');
    try {
      await onSave({ title: trimmedTitle, description: description.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this card.');
      setBusy(null);
    }
  }

  async function remove() {
    setError(null);
    setBusy('delete');
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this card.');
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit card in ${columnTitle}`}
        className="animate-in w-full max-w-lg rounded-t-2xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)] sm:rounded-2xl"
      >
        <p className="text-sm font-medium text-ink-faint">In {columnTitle}</p>

        <form onSubmit={submit} className="mt-3">
          <label htmlFor="task-title" className="label">
            Title
          </label>
          <textarea
            id="task-title"
            ref={titleRef}
            rows={2}
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submit(e);
            }}
            className="input resize-none"
          />

          <label htmlFor="task-description" className="label mt-4">
            Description <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <textarea
            id="task-description"
            rows={5}
            value={description}
            maxLength={DESCRIPTION_MAX_LENGTH}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Anything the card needs to carry with it."
            className="input resize-y"
          />

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-danger/25 bg-danger-tint px-3 py-2.5 text-sm font-medium text-danger"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!trimmedTitle || tooLong || busy !== null}
              className="btn btn-primary"
            >
              {busy === 'save' ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>

            <span className="ml-auto">
              {confirmingDelete ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm text-ink-soft">Delete this card?</span>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy !== null}
                    className="btn btn-sm bg-danger text-white hover:bg-danger/90"
                  >
                    {busy === 'delete' ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="btn btn-ghost btn-sm"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={busy !== null}
                  className="btn btn-ghost btn-sm text-danger hover:bg-danger-tint"
                >
                  Delete card
                </button>
              )}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
