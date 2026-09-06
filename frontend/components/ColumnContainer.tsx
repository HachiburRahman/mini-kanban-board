'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { MoveDirection } from '@/lib/board-moves';
import type { Column, Task } from '@/lib/types';
import { TITLE_MAX_LENGTH } from '@/lib/validation';
import { Menu } from './Menu';
import { TaskCard } from './TaskCard';

const LANE_HUES = [
  'var(--color-lane-1)',
  'var(--color-lane-2)',
  'var(--color-lane-3)',
  'var(--color-lane-4)',
];

export function ColumnContainer({
  column,
  index,
  columnCount,
  onAddTask,
  onRename,
  onDelete,
  onMove,
  onEditTask,
  onKeyboardMove,
}: {
  column: Column;
  index: number;
  columnCount: number;
  onAddTask: (columnId: string, title: string) => void;
  onRename: (columnId: string, title: string) => void;
  onDelete: (column: Column) => void;
  onMove: (columnId: string, index: number) => void;
  onEditTask: (task: Task) => void;
  onKeyboardMove: (taskId: string, direction: MoveDirection) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [composing, setComposing] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(column.title);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (composing) inputRef.current?.focus();
  }, [composing]);

  useEffect(() => {
    if (renaming) {
      setDraftTitle(column.title);
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [renaming, column.title]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    onAddTask(column.id, title);
    setNewTaskTitle('');
    inputRef.current?.focus();
  }

  // Escape has to beat the blur that closing the field causes, and blur-on-
  // unmount is not something to trust across browsers - so say explicitly
  // that this edit was abandoned.
  const cancelled = useRef(false);

  function submitRename(e?: FormEvent) {
    e?.preventDefault();
    setRenaming(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const title = draftTitle.trim();
    if (title && title !== column.title) onRename(column.id, title);
  }

  return (
    <section
      className={[
        // Snap-sized on phones so one column fills the screen and the next
        // is a single swipe away; fixed width once there is room for several.
        'flex w-[85vw] max-w-[20rem] flex-none snap-start flex-col rounded-xl border bg-sunken/70 sm:w-[19rem]',
        isOver ? 'border-accent/50 bg-accent-tint/60' : 'border-line',
      ].join(' ')}
      aria-label={column.title}
    >
      <header className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 flex-none rounded-full"
          style={{ backgroundColor: LANE_HUES[index % LANE_HUES.length] }}
        />

        {renaming ? (
          <form onSubmit={submitRename} className="min-w-0 flex-1">
            <label htmlFor={`rename-column-${column.id}`} className="sr-only">
              Rename column
            </label>
            <input
              id={`rename-column-${column.id}`}
              ref={renameRef}
              className="input py-1 text-[0.9375rem] font-bold"
              value={draftTitle}
              maxLength={TITLE_MAX_LENGTH}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={() => submitRename()}
              onKeyDown={(e) => {
                // Commit on Enter explicitly. This form has no submit button,
                // and implicit submission is not something every browser does
                // in that case.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitRename();
                }
                if (e.key === 'Escape') {
                  cancelled.current = true;
                  setRenaming(false);
                }
              }}
            />
          </form>
        ) : (
          <h2 className="min-w-0 flex-1 truncate font-display text-[0.9375rem] font-bold">
            {column.title}
          </h2>
        )}

        <span className="flex-none rounded-full bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-soft">
          {column.tasks.length}
        </span>

        <Menu
          label={`Column actions for ${column.title}`}
          items={[
            { label: 'Rename column', onSelect: () => setRenaming(true) },
            {
              label: 'Move left',
              onSelect: () => onMove(column.id, index - 1),
              disabled: index === 0,
            },
            {
              label: 'Move right',
              onSelect: () => onMove(column.id, index + 1),
              disabled: index === columnCount - 1,
            },
            { label: 'Delete column', onSelect: () => onDelete(column), danger: true },
          ]}
        />
      </header>

      <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-[3.5rem] flex-col gap-2 px-2.5 pb-1">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onKeyboardMove={onKeyboardMove}
            />
          ))}

          {column.tasks.length === 0 && !composing && (
            <p className="rounded-lg border border-dashed border-line-strong px-3 py-5 text-center text-sm text-ink-faint">
              Drop a card here
            </p>
          )}
        </div>
      </SortableContext>

      <div className="p-2.5">
        {composing ? (
          <form onSubmit={submit} className="rounded-lg border border-accent bg-surface p-2">
            <label htmlFor={`new-task-${column.id}`} className="sr-only">
              New card in {column.title}
            </label>
            <textarea
              id={`new-task-${column.id}`}
              ref={inputRef}
              rows={2}
              value={newTaskTitle}
              maxLength={TITLE_MAX_LENGTH}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) submit(e);
                if (e.key === 'Escape') setComposing(false);
              }}
              placeholder="What needs doing?"
              className="w-full resize-none bg-transparent text-[0.9375rem] leading-snug outline-none placeholder:text-ink-faint"
            />
            <div className="mt-1 flex items-center gap-2">
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="btn btn-primary btn-sm"
              >
                Add card
              </button>
              <button
                type="button"
                onClick={() => {
                  setComposing(false);
                  setNewTaskTitle('');
                }}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="btn btn-ghost w-full justify-start"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>
            Add card
          </button>
        )}
      </div>
    </section>
  );
}
