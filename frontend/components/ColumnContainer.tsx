'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { type FormEvent, useState } from 'react';
import type { Column } from '@/lib/types';
import { TaskCard } from './TaskCard';

export function ColumnContainer({
  column,
  onAddTask,
}: {
  column: Column;
  onAddTask: (columnId: string, title: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });
  const [newTaskTitle, setNewTaskTitle] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask(column.id, newTaskTitle);
    setNewTaskTitle('');
  }

  return (
    <div className="flex w-72 flex-none flex-col rounded-lg bg-slate-100 p-3">
      <h2 className="mb-3 px-1 text-sm font-semibold text-slate-700">{column.title}</h2>

      <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-[2.5rem] flex-col gap-2">
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>

      <form onSubmit={submit} className="mt-3">
        <input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="+ Add task"
          className="w-full rounded-md border border-transparent bg-white/60 px-2 py-1 text-sm focus:border-slate-300 focus:bg-white focus:outline-none"
        />
      </form>
    </div>
  );
}
