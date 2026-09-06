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
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { clearSession, getStoredUser, getToken } from '@/lib/auth';
import {
  applyColumnMove,
  applyTaskMove,
  describeKeyboardMove,
  locateTask,
  planKeyboardMove,
  type MoveDirection,
} from '@/lib/board-moves';
import { createAnnouncements } from '@/lib/dnd-announcements';
import { TITLE_MAX_LENGTH } from '@/lib/validation';
import type { AuthUser, BoardDetail, BoardMember, Column, Task } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { ColumnContainer } from '@/components/ColumnContainer';
import { Menu } from '@/components/Menu';
import { SharePanel } from '@/components/SharePanel';
import { TaskCard } from '@/components/TaskCard';
import { TaskDialog } from '@/components/TaskDialog';

/** Finds the column that currently holds a given task, in local state. */
function findColumnOfTask(columns: Column[], taskId: string): Column | undefined {
  return columns.find((col) => col.tasks.some((t) => t.id === taskId));
}

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const router = useRouter();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [renamingBoard, setRenamingBoard] = useState(false);
  const [boardTitleDraft, setBoardTitleDraft] = useState('');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [refocusTaskId, setRefocusTaskId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // The arrangement a drag started from. dnd-kit fires onDragCancel (Escape)
  // instead of onDragEnd, and handleDragOver has already moved the card into
  // another column by then - without this the board kept showing a move that
  // was never sent, and the announcer said the card "returned to where it
  // started" while it visibly had not.
  const preDragColumns = useRef<Column[] | null>(null);

  // Escape has to beat the blur that closing the rename field causes, and
  // blur-on-unmount is not something to trust across browsers.
  const renameCancelled = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch needs a press-and-hold before a drag begins, otherwise every
    // attempt to scroll the board vertically would pick up a card instead.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    try {
      const data = await api.getBoard(params.boardId);
      setBoard(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace('/login');
        return;
      }
      setLoadError('This board is not available. It may have been deleted, or your access removed.');
    }
  }, [params.boardId, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setCurrentUser(getStoredUser<AuthUser>());
    load();
  }, [load, router]);

  const isOwner = currentUser?.id === board?.ownerId;

  /**
   * Every mutation goes through here, so a failure always lands somewhere the
   * user can see it instead of becoming an unhandled promise rejection.
   * `revert` puts optimistic state back when the server disagrees.
   */
  const run = useCallback(
    async (action: () => Promise<void>, fallback: string, revert?: () => void) => {
      setActionError(null);
      try {
        await action();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          router.replace('/login');
          return;
        }
        revert?.();
        setActionError(err instanceof ApiError ? err.message : fallback);
      }
    },
    [router],
  );

  const setColumns = useCallback((next: (columns: Column[]) => Column[]) => {
    setBoard((prev) => (prev ? { ...prev, columns: next(prev.columns) } : prev));
  }, []);

  // Latest board, readable from callbacks without making them re-create on
  // every keystroke.
  const boardRef = useRef<BoardDetail | null>(null);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // --- drag and drop -------------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    if (!board) return;
    preDragColumns.current = board.columns;
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

  /** Puts the board back to how it looked when the drag began. */
  function revertDrag() {
    const snapshot = preDragColumns.current;
    if (snapshot) setColumns(() => snapshot);
    preDragColumns.current = null;
  }

  function handleDragCancel() {
    setActiveTask(null);
    revertDrag();
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!board) return;

    // Dropped on nothing at all: undo the cross-column preview rather than
    // leaving the board showing a move the server never heard about.
    if (!over) {
      revertDrag();
      return;
    }

    const column = findColumnOfTask(board.columns, String(active.id));
    if (!column) {
      revertDrag();
      return;
    }

    const activeIndex = column.tasks.findIndex((t) => t.id === active.id);
    const overIndex = column.tasks.findIndex((t) => t.id === over.id);
    let finalIndex = activeIndex;

    if (overIndex >= 0 && activeIndex !== overIndex) {
      const reordered = arrayMove(column.tasks, activeIndex, overIndex);
      finalIndex = overIndex;
      setColumns((columns) =>
        columns.map((c) => (c.id === column.id ? { ...c, tasks: reordered } : c)),
      );
    }

    const snapshot = preDragColumns.current;
    preDragColumns.current = null;

    await run(
      async () => {
        await api.moveTask(String(active.id), { columnId: column.id, index: finalIndex });
      },
      'Could not move that card.',
      () => {
        // Fell out of sync with the server (e.g. someone else moved a task at
        // the same time) - put the card back, then refetch the true state.
        if (snapshot) setColumns(() => snapshot);
        load();
      },
    );
  }

  // --- keyboard movement ---------------------------------------------------

  const onKeyboardMove = useCallback(
    (taskId: string, direction: MoveDirection) => {
      const current = boardRef.current;
      if (!current) return;

      const plan = planKeyboardMove(current.columns, taskId, direction);
      if (!plan) {
        setAnnouncement(
          direction === 'left' || direction === 'right'
            ? 'There is no column that way.'
            : 'That card is already at the end of its column.',
        );
        return;
      }

      const before = current.columns;
      const columns = applyTaskMove(before, taskId, plan);
      setColumns(() => columns);
      setAnnouncement(describeKeyboardMove(columns, taskId));
      // The card unmounts and remounts when it changes column, taking focus
      // with it - put it back so the next arrow press keeps working.
      setRefocusTaskId(taskId);

      run(
        async () => {
          await api.moveTask(taskId, { columnId: plan.columnId, index: plan.index });
        },
        'Could not move that card.',
        () => {
          setColumns(() => before);
          load();
        },
      );
    },
    [load, run, setColumns],
  );

  // Runs after the commit, so the card's new DOM node already exists. Note
  // this deliberately does NOT wait for an animation frame: a background or
  // hidden tab never fires one, and the move still needs to leave focus
  // somewhere sensible.
  useEffect(() => {
    if (!refocusTaskId) return;
    document.querySelector<HTMLElement>(`[data-task-id="${refocusTaskId}"]`)?.focus();
    setRefocusTaskId(null);
  }, [refocusTaskId]);

  // --- boards --------------------------------------------------------------

  function onRenameBoard(e?: FormEvent) {
    e?.preventDefault();
    setRenamingBoard(false);
    if (renameCancelled.current) {
      renameCancelled.current = false;
      return;
    }
    const title = boardTitleDraft.trim();
    if (!board || !title || title === board.title) return;

    const previous = board.title;
    setBoard((prev) => (prev ? { ...prev, title } : prev));
    run(
      async () => {
        await api.updateBoard(board.id, { title });
      },
      'Could not rename this board.',
      () => setBoard((prev) => (prev ? { ...prev, title: previous } : prev)),
    );
  }

  function onDeleteBoard() {
    if (!board) return;
    if (!window.confirm(`Delete "${board.title}" and everything on it? This cannot be undone.`)) {
      return;
    }
    run(async () => {
      await api.deleteBoard(board.id);
      router.replace('/boards');
    }, 'Could not delete this board.');
  }

  // --- columns -------------------------------------------------------------

  function onAddColumn(e: FormEvent) {
    e.preventDefault();
    const title = newColumnTitle.trim();
    if (!title || !board) return;
    setNewColumnTitle('');
    setAddingColumn(false);
    run(async () => {
      const column = await api.createColumn(board.id, title);
      setColumns((columns) => [...columns, { ...column, tasks: [] }]);
    }, 'Could not add that column.');
  }

  function onRenameColumn(columnId: string, title: string) {
    const before = board?.columns ?? [];
    setColumns((columns) => columns.map((c) => (c.id === columnId ? { ...c, title } : c)));
    run(
      async () => {
        await api.updateColumn(columnId, { title });
      },
      'Could not rename that column.',
      () => setColumns(() => before),
    );
  }

  function onDeleteColumn(column: Column) {
    const cards = column.tasks.length;
    const warning = cards
      ? `Delete "${column.title}" and its ${cards} card${cards === 1 ? '' : 's'}?`
      : `Delete "${column.title}"?`;
    if (!window.confirm(warning)) return;

    const before = board?.columns ?? [];
    setColumns((columns) => columns.filter((c) => c.id !== column.id));
    run(
      async () => {
        await api.deleteColumn(column.id);
      },
      'Could not delete that column.',
      () => setColumns(() => before),
    );
  }

  function onMoveColumn(columnId: string, index: number) {
    const before = board?.columns ?? [];
    setColumns((columns) => applyColumnMove(columns, columnId, index));
    run(
      async () => {
        await api.moveColumn(columnId, { index });
      },
      'Could not move that column.',
      () => setColumns(() => before),
    );
  }

  // --- tasks ---------------------------------------------------------------

  function onAddTask(columnId: string, title: string) {
    run(async () => {
      const task = await api.createTask(columnId, { title });
      setColumns((columns) =>
        columns.map((c) => (c.id === columnId ? { ...c, tasks: [...c.tasks, task] } : c)),
      );
    }, 'Could not add that card.');
  }

  async function onSaveTask(taskId: string, data: { title: string; description: string }) {
    const updated = await api.updateTask(taskId, {
      title: data.title,
      description: data.description,
    });
    setColumns((columns) =>
      columns.map((c) => ({
        ...c,
        tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, ...updated } : t)),
      })),
    );
  }

  async function onDeleteTask(taskId: string) {
    await api.deleteTask(taskId);
    setColumns((columns) =>
      columns.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) })),
    );
  }

  // Memoised so DndContext isn't handed a fresh accessibility object on every
  // render. Precautionary rather than a fix for anything observed.
  const columns = board?.columns;
  const accessibility = useMemo(
    () => ({ announcements: createAnnouncements(columns ?? []) }),
    [columns],
  );

  const editingLocation = board && editingTask ? locateTask(board.columns, editingTask.id) : null;

  if (loadError) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-display text-xl font-bold">Board unavailable</h1>
          <p className="mt-2 text-ink-soft">{loadError}</p>
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
          {renamingBoard ? (
            <form onSubmit={onRenameBoard} className="min-w-0 flex-1">
              <label htmlFor="board-rename" className="sr-only">
                Rename board
              </label>
              <input
                id="board-rename"
                autoFocus
                className="input font-display text-[1.75rem] font-bold sm:text-[2.125rem]"
                value={boardTitleDraft}
                maxLength={TITLE_MAX_LENGTH}
                onChange={(e) => setBoardTitleDraft(e.target.value)}
                onBlur={() => onRenameBoard()}
                onKeyDown={(e) => {
                  // Commit on Enter explicitly - see the column rename field.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onRenameBoard();
                  }
                  if (e.key === 'Escape') {
                    renameCancelled.current = true;
                    setRenamingBoard(false);
                  }
                }}
              />
            </form>
          ) : (
            <h1 className="font-display text-[1.75rem] font-bold sm:text-[2.125rem]">
              {board.title}
            </h1>
          )}

          <div className="ml-auto flex items-center gap-2">
            <SharePanel
              board={board}
              isOwner={isOwner}
              onMembersChanged={(members: BoardMember[]) =>
                setBoard((prev) => (prev ? { ...prev, members } : prev))
              }
            />
            {isOwner && (
              <Menu
                label="Board actions"
                items={[
                  {
                    label: 'Rename board',
                    onSelect: () => {
                      setBoardTitleDraft(board.title);
                      setRenamingBoard(true);
                    },
                  },
                  { label: 'Delete board', onSelect: onDeleteBoard, danger: true },
                ]}
              />
            )}
          </div>
        </div>

        {actionError && (
          <div className="mx-auto w-full max-w-7xl px-4 pb-4 sm:px-6">
            <p
              role="alert"
              className="flex items-center gap-3 rounded-md border border-danger/25 bg-danger-tint px-3 py-2.5 text-sm font-medium text-danger"
            >
              <span className="flex-1">{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="rounded px-2 py-1 font-semibold hover:bg-danger/10"
              >
                Dismiss
              </button>
            </p>
          </div>
        )}

        {/* Keyboard moves happen outside dnd-kit, so they need their own live
            region - dnd-kit's announcer only narrates pointer/space drags. */}
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <DndContext
          accessibility={accessibility}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
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
                  columnCount={board.columns.length}
                  onAddTask={onAddTask}
                  onRename={onRenameColumn}
                  onDelete={onDeleteColumn}
                  onMove={onMoveColumn}
                  onEditTask={setEditingTask}
                  onKeyboardMove={onKeyboardMove}
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
                      maxLength={TITLE_MAX_LENGTH}
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

        <p className="mx-auto max-w-7xl px-4 pb-10 text-sm text-ink-faint sm:px-6">
          Drag a card, or focus one and hold <kbd className="kbd">Ctrl</kbd> with the arrow keys to
          move it between columns.
        </p>
      </main>

      {editingTask && editingLocation && (
        <TaskDialog
          task={editingLocation.task}
          columnTitle={editingLocation.column.title}
          onSave={(data) => onSaveTask(editingTask.id, data)}
          onDelete={() => onDeleteTask(editingTask.id)}
          onClose={() => setEditingTask(null)}
        />
      )}
    </>
  );
}
