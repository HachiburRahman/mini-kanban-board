'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { Column } from '@/lib/types';
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
  onAddTask,
}: {
  column: Column;
  index: number;
  onAddTask: (columnId: string, title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [composing, setComposing] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (composing) inputRef.current?.focus();
  }, [composing]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    onAddTask(column.id, title);
    setNewTaskTitle('');
    inputRef.current?.focus();
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
        <h2 className="min-w-0 flex-1 truncate font-display text-[0.9375rem] font-bold">
          {column.title}
        </h2>
        <span className="flex-none rounded-full bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-soft">
          {column.tasks.length}
        </span>
      </header>

      <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-[3.5rem] flex-col gap-2 px-2.5 pb-1">
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
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
