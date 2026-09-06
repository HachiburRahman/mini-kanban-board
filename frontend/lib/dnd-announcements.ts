import type { UniqueIdentifier } from '@dnd-kit/core';
import type { Column } from './types';

type Target = { id: UniqueIdentifier } | null | undefined;

/**
 * Screen-reader announcements for board drag and drop.
 *
 * dnd-kit's default announcer reads raw record ids - "Draggable item
 * cmtlsw49h000k4fisb9udwmb0 was moved over droppable area cmtlsw31a000c..." -
 * which tells someone using a screen reader nothing at all about what they just
 * picked up or where it is going. These name the card, the column, and the
 * position within it.
 */
export function createAnnouncements(columns: Column[]) {
  function describeTask(id: UniqueIdentifier): string {
    const taskId = String(id);
    for (const column of columns) {
      const task = column.tasks.find((t) => t.id === taskId);
      if (task) return `"${task.title}"`;
    }
    return 'card';
  }

  /** A drop target is either a column, or a card whose column we name. */
  function describeTarget(id: UniqueIdentifier): string {
    const targetId = String(id);

    const column = columns.find((c) => c.id === targetId);
    if (column) return `column "${column.title}"`;

    for (const c of columns) {
      const index = c.tasks.findIndex((t) => t.id === targetId);
      if (index >= 0) {
        return `position ${index + 1} of ${c.tasks.length} in column "${c.title}"`;
      }
    }
    return 'the board';
  }

  return {
    onDragStart: ({ active }: { active: { id: UniqueIdentifier } }) =>
      `Picked up card ${describeTask(active.id)}. Use the arrow keys to move it, space to drop, escape to cancel.`,

    onDragOver: ({ active, over }: { active: { id: UniqueIdentifier }; over: Target }) =>
      over
        ? `Card ${describeTask(active.id)} is over ${describeTarget(over.id)}.`
        : `Card ${describeTask(active.id)} is not over a column.`,

    onDragEnd: ({ active, over }: { active: { id: UniqueIdentifier }; over: Target }) =>
      over
        ? `Dropped card ${describeTask(active.id)} into ${describeTarget(over.id)}.`
        : `Card ${describeTask(active.id)} was dropped outside a column and returned to where it started.`,

    onDragCancel: ({ active }: { active: { id: UniqueIdentifier } }) =>
      `Cancelled. Card ${describeTask(active.id)} returned to where it started.`,
  };
}
