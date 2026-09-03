'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import type { Task } from '@/lib/types';

export function TaskCard({ task, overlay = false }: { task: Task; overlay?: boolean }) {
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

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={[
        'group touch-manipulation rounded-lg border bg-surface px-3.5 py-3 select-none',
        overlay
          ? 'rotate-[1.5deg] border-accent/40 shadow-[var(--shadow-raised)]'
          : 'cursor-grab border-line shadow-[var(--shadow-card)] transition hover:border-line-strong hover:shadow-[var(--shadow-raised)] active:cursor-grabbing',
      ].join(' ')}
    >
      <p className="text-[0.9375rem] leading-snug font-medium break-words">{task.title}</p>
      {task.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{task.description}</p>
      )}
    </article>
  );
}
