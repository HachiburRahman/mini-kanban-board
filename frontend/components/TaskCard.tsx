'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { MoveDirection } from '@/lib/board-moves';
import type { Task } from '@/lib/types';

const ARROW_DIRECTIONS: Record<string, MoveDirection> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

export function TaskCard({
  task,
  overlay = false,
  onEdit,
  onKeyboardMove,
}: {
  task: Task;
  overlay?: boolean;
  onEdit?: (task: Task) => void;
  onKeyboardMove?: (taskId: string, direction: MoveDirection) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Hide the original while its overlay clone is under the cursor, rather
    // than dragging a semi-transparent duplicate around.
    opacity: isDragging ? 0 : 1,
  };

  /**
   * Ctrl/Cmd + arrow moves the card without a pointer. dnd-kit's KeyboardSensor
   * cannot carry a card between columns on a horizontally scrollable lane - it
   * scrolls the lane instead - so cross-column movement is an explicit
   * shortcut rather than simulated drag coordinates.
   */
  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    const direction = ARROW_DIRECTIONS[e.key];
    if (!direction || !onKeyboardMove) return;
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    e.stopPropagation();
    onKeyboardMove(task.id, direction);
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-task-id={overlay ? undefined : task.id}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      className={[
        'group relative touch-manipulation rounded-lg border bg-surface px-3.5 py-3 select-none',
        overlay
          ? 'rotate-[1.5deg] border-accent/40 shadow-[var(--shadow-raised)]'
          : 'cursor-grab border-line shadow-[var(--shadow-card)] transition hover:border-line-strong hover:shadow-[var(--shadow-raised)] active:cursor-grabbing',
      ].join(' ')}
    >
      {/* Clamped so an over-long title (or one stored before the API enforced
          a limit) can't stretch the column and push "Add card" off screen. */}
      <p
        title={task.title}
        className="line-clamp-4 pr-6 text-[0.9375rem] leading-snug font-medium break-words"
      >
        {task.title}
      </p>
      {task.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{task.description}</p>
      )}

      {!overlay && onEdit && (
        <button
          type="button"
          aria-label={`Edit card "${task.title}"`}
          // The card itself is the drag handle, so the button has to keep its
          // own pointerdown away from the sensor or every click starts a drag.
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-md text-ink-faint opacity-0 transition hover:bg-sunken hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M13.6 2.6a2 2 0 0 1 2.8 2.8l-.9.9-2.8-2.8.9-.9ZM11.6 4.6l2.8 2.8-7 7L4 15l.6-3.4 7-7Z" />
          </svg>
        </button>
      )}
    </article>
  );
}
