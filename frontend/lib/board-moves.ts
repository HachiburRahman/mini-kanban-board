import type { Column, Task } from './types';

export type MoveDirection = 'left' | 'right' | 'up' | 'down';

export interface TaskMovePlan {
  /** The column the task should end up in. */
  columnId: string;
  /** 0-based slot among the target column's OTHER tasks - what the API wants. */
  index: number;
}

/** Where a task currently sits, in local board state. */
export function locateTask(columns: Column[], taskId: string) {
  for (const [columnIndex, column] of columns.entries()) {
    const taskIndex = column.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex >= 0) return { columnIndex, taskIndex, column, task: column.tasks[taskIndex] };
  }
  return null;
}

/**
 * Works out where an arrow-key move should land a card.
 *
 * Cross-column movement used to be expressed as simulated pointer coordinates
 * through dnd-kit's KeyboardSensor, which reads the lane's live geometry after
 * the coordinate getter returns and scrolls the lane INSTEAD of moving the card
 * whenever the target x sits past the scroll container's midpoint. The board
 * lane is always horizontally scrollable, so that branch fired for any column
 * not already at the left edge and keyboard users simply could not move a card
 * between columns.
 *
 * Ctrl/Cmd + arrow sidesteps the geometry entirely: it is a plain index
 * calculation feeding the same `moveTask` call the drag already uses, so it is
 * deterministic, works with empty columns, and works in both directions.
 *
 * Returns null when the move has nowhere to go (already at an edge).
 */
export function planKeyboardMove(
  columns: Column[],
  taskId: string,
  direction: MoveDirection,
): TaskMovePlan | null {
  const at = locateTask(columns, taskId);
  if (!at) return null;
  const { columnIndex, taskIndex, column } = at;

  if (direction === 'up') {
    return taskIndex === 0 ? null : { columnId: column.id, index: taskIndex - 1 };
  }

  if (direction === 'down') {
    return taskIndex === column.tasks.length - 1
      ? null
      : { columnId: column.id, index: taskIndex + 1 };
  }

  const targetIndex = direction === 'left' ? columnIndex - 1 : columnIndex + 1;
  const target = columns[targetIndex];
  if (!target) return null;

  // Keep the card at roughly the same height in its new lane, clamped to what
  // the target column can actually hold.
  return { columnId: target.id, index: Math.min(taskIndex, target.tasks.length) };
}

/**
 * Applies a task move to local board state, producing the exact arrangement the
 * API will end up with. Used for the optimistic update so the UI and the server
 * cannot disagree about what a move meant.
 */
export function applyTaskMove(columns: Column[], taskId: string, plan: TaskMovePlan): Column[] {
  const at = locateTask(columns, taskId);
  if (!at) return columns;

  const moved: Task = { ...at.task, columnId: plan.columnId };

  return columns.map((column) => {
    const withoutTask = column.tasks.filter((t) => t.id !== taskId);
    if (column.id !== plan.columnId) {
      return withoutTask.length === column.tasks.length ? column : { ...column, tasks: withoutTask };
    }
    const index = Math.min(Math.max(plan.index, 0), withoutTask.length);
    const tasks = [...withoutTask.slice(0, index), moved, ...withoutTask.slice(index)];
    return { ...column, tasks };
  });
}

/** Applies a column reorder to local board state. */
export function applyColumnMove(columns: Column[], columnId: string, index: number): Column[] {
  const from = columns.findIndex((c) => c.id === columnId);
  if (from < 0) return columns;

  const without = columns.filter((c) => c.id !== columnId);
  const at = Math.min(Math.max(index, 0), without.length);
  return [...without.slice(0, at), columns[from], ...without.slice(at)];
}

/**
 * What to read out after a keyboard move. dnd-kit's announcer only covers
 * drags, so keyboard moves need their own live-region message.
 */
export function describeKeyboardMove(columns: Column[], taskId: string): string {
  const at = locateTask(columns, taskId);
  if (!at) return 'Card moved.';
  return `Moved "${at.task.title}" to position ${at.taskIndex + 1} of ${at.column.tasks.length} in column "${at.column.title}".`;
}
