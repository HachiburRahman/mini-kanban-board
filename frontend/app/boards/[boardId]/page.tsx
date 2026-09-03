'use client';

import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { clearSession, getStoredUser, getToken } from '@/lib/auth';
import type { AuthUser, BoardDetail, BoardMember, Column, Task } from '@/lib/types';
import { ColumnContainer } from '@/components/ColumnContainer';
import { SharePanel } from '@/components/SharePanel';
import { TaskCard } from '@/components/TaskCard';

/** Finds the column that currently holds a given task, in local state. */
function findColumnOfTask(columns: Column[], taskId: string): Column | undefined {
  return columns.find((col) => col.tasks.some((t) => t.id === taskId));
}

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const router = useRouter();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setCurrentUser(getStoredUser<AuthUser>());
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.boardId]);

  async function load() {
    try {
      const data = await api.getBoard(params.boardId);
      setBoard(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace('/login');
        return;
      }
      setError('Could not load this board (maybe you no longer have access to it)');
    }
  }

  function handleDragStart(event: DragStartEvent) {
    if (!board) return;
    const column = findColumnOfTask(board.columns, String(event.active.id));
    const task = column?.tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  // Cross-column drag: as the card passes over a different column, move it
  // there visually right away. Same-column reordering is finalised in
  // handleDragEnd instead, so it doesn't jitter mid-drag.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !board || active.id === over.id) return;

    const activeColumn = findColumnOfTask(board.columns, String(active.id));
    const overColumn =
      board.columns.find((c) => c.id === over.id) ?? findColumnOfTask(board.columns, String(over.id));
    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return;

    setBoard((prev) => {
      if (!prev) return prev;
      const columns = prev.columns.map((c) => ({ ...c, tasks: [...c.tasks] }));
      const from = columns.find((c) => c.id === activeColumn.id)!;
      const to = columns.find((c) => c.id === overColumn.id)!;

      const activeIndex = from.tasks.findIndex((t) => t.id === active.id);
      if (activeIndex === -1) return prev;
      const [task] = from.tasks.splice(activeIndex, 1);

      const overTaskIndex = to.tasks.findIndex((t) => t.id === over.id);
      const insertAt = overTaskIndex >= 0 ? overTaskIndex : to.tasks.length;
      to.tasks.splice(insertAt, 0, { ...task, columnId: to.id });

      return { ...prev, columns };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !board) return;

    const column = findColumnOfTask(board.columns, String(active.id));
    if (!column) return;

    const activeIndex = column.tasks.findIndex((t) => t.id === active.id);
    const overIndex = column.tasks.findIndex((t) => t.id === over.id);
    let finalIndex = activeIndex;

    if (overIndex >= 0 && activeIndex !== overIndex) {
      const reordered = arrayMove(column.tasks, activeIndex, overIndex);
      finalIndex = overIndex;
      setBoard((prev) =>
        prev
          ? { ...prev, columns: prev.columns.map((c) => (c.id === column.id ? { ...c, tasks: reordered } : c)) }
          : prev,
      );
    }

    try {
      await api.moveTask(String(active.id), { columnId: column.id, index: finalIndex });
    } catch {
      // Fell out of sync with the server (e.g. someone else moved a task at
      // the same time) - just refetch the true state rather than guessing.
      load();
    }
  }

  async function onAddColumn(e: FormEvent) {
    e.preventDefault();
    if (!newColumnTitle.trim() || !board) return;
    const column = await api.createColumn(board.id, newColumnTitle);
    setNewColumnTitle('');
    setBoard((prev) => (prev ? { ...prev, columns: [...prev.columns, { ...column, tasks: [] }] } : prev));
  }

  async function onAddTask(columnId: string, title: string) {
    const task = await api.createTask(columnId, title);
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((c) => (c.id === columnId ? { ...c, tasks: [...c.tasks, task] } : c)),
      };
    });
  }

  function onMembersChanged(members: BoardMember[]) {
    setBoard((prev) => (prev ? { ...prev, members } : prev));
  }

  if (error) return <p className="p-8 text-sm text-red-600">{error}</p>;
  if (!board) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{board.title}</h1>
        <Link href="/boards" className="text-sm text-slate-500 underline">
          All boards
        </Link>
      </div>

      <SharePanel
        board={board}
        isOwner={currentUser?.id === board.ownerId}
        onMembersChanged={onMembersChanged}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {board.columns.map((column) => (
            <ColumnContainer key={column.id} column={column} onAddTask={onAddTask} />
          ))}

          <form onSubmit={onAddColumn} className="w-72 flex-none">
            <input
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              placeholder="+ Add column"
              className="w-full rounded-lg border border-dashed border-slate-300 bg-transparent px-3 py-2 text-sm"
            />
          </form>
        </div>

        <DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay>
      </DndContext>
    </main>
  );
}
