'use client';

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { clearSession, getStoredUser, getToken } from '@/lib/auth';
import { createAnnouncements } from '@/lib/dnd-announcements';
import type { AuthUser, BoardDetail, BoardMember, Column, Task } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
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
  const [addingColumn, setAddingColumn] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch needs a press-and-hold before a drag begins, otherwise every
    // attempt to scroll the board vertically would pick up a card instead.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      setError('This board is not available. It may have been deleted, or your access removed.');
    }
  }

  function handleDragStart(event: DragStartEvent) {
    if (!board) return;
    const column = findColumnOfTask(board.columns, String(event.active.id));
    setActiveTask(column?.tasks.find((t) => t.id === event.active.id) ?? null);
  }

  // Cross-column drag: as the card passes over a different column, move it
  // there visually right away. Same-column reordering is finalised in
  // handleDragEnd instead, so it doesn't jitter mid-drag.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !board || active.id === over.id) return;

    const activeColumn = findColumnOfTask(board.columns, String(active.id));
    const overColumn =
      board.columns.find((c) => c.id === over.id) ??
      findColumnOfTask(board.columns, String(over.id));
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
          ? {
              ...prev,
              columns: prev.columns.map((c) =>
                c.id === column.id ? { ...c, tasks: reordered } : c,
              ),
            }
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
    const title = newColumnTitle.trim();
    if (!title || !board) return;
    const column = await api.createColumn(board.id, title);
    setNewColumnTitle('');
    setAddingColumn(false);
    setBoard((prev) =>
      prev ? { ...prev, columns: [...prev.columns, { ...column, tasks: [] }] } : prev,
    );
  }

  async function onAddTask(columnId: string, title: string) {
    const task = await api.createTask(columnId, title);
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map((c) =>
              c.id === columnId ? { ...c, tasks: [...c.tasks, task] } : c,
            ),
          }
        : prev,
    );
  }

  function onMembersChanged(members: BoardMember[]) {
    setBoard((prev) => (prev ? { ...prev, members } : prev));
  }

  const announcements = createAnnouncements(board?.columns ?? []);

  if (error) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-display text-xl font-bold">Board unavailable</h1>
          <p className="mt-2 text-ink-soft">{error}</p>
          <a href="/boards" className="btn btn-secondary mt-6">
            Back to your boards
          </a>
        </main>
      </>
    );
  }

  if (!board) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="h-9 w-52 animate-pulse rounded-md bg-sunken" />
          <div className="mt-8 flex gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 w-[19rem] flex-none animate-pulse rounded-xl bg-sunken" />
            ))}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader crumb={board.title} />

      <main>
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 pt-7 pb-5 sm:px-6">
          <h1 className="font-display text-[1.75rem] font-bold sm:text-[2.125rem]">{board.title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <SharePanel
              board={board}
              isOwner={currentUser?.id === board.ownerId}
              onMembersChanged={onMembersChanged}
            />
          </div>
        </div>

        <DndContext
          accessibility={{ announcements }}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* The scroller is constrained to the same container as the page
              header, so lanes line up with the board title instead of
              floating centred once they stop filling the width. */}
          <div className="lane-scroll mx-auto w-full max-w-7xl snap-x snap-mandatory overflow-x-auto px-4 pb-6 sm:snap-none sm:px-6">
            <div className="flex w-max items-start gap-4">
              {board.columns.map((column, i) => (
                <ColumnContainer
                  key={column.id}
                  column={column}
                  index={i}
                  onAddTask={onAddTask}
                />
              ))}

              <div className="w-[85vw] max-w-[20rem] flex-none snap-start sm:w-[19rem]">
                {addingColumn ? (
                  <form
                    onSubmit={onAddColumn}
                    className="rounded-xl border border-accent bg-surface p-2.5"
                  >
                    <label htmlFor="new-column" className="sr-only">
                      New column name
                    </label>
                    <input
                      id="new-column"
                      autoFocus
                      className="input"
                      placeholder="In review"
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setAddingColumn(false)}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={!newColumnTitle.trim()}
                        className="btn btn-primary btn-sm"
                      >
                        Add column
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingColumn(false)}
                        className="btn btn-ghost btn-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingColumn(true)}
                    className="btn btn-ghost w-full justify-start rounded-xl border border-dashed border-line-strong"
                  >
                    <span aria-hidden="true" className="text-lg leading-none">
                      +
                    </span>
                    Add column
                  </button>
                )}
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
            {activeTask ? <TaskCard task={activeTask} overlay /> : null}
          </DragOverlay>
        </DndContext>
      </main>
    </>
  );
}
