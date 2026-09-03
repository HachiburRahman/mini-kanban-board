// Regression: ISSUE-003 — drag announcements read raw database ids to screen readers
// Found by /qa on 2026-09-03
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-09-03.md
//
// dnd-kit's default announcer said "Draggable item cmtlsw49h000k4fisb9udwmb0 was
// moved over droppable area cmtlsw31a000c4fisjfctn5mv." A screen reader user heard
// a CUID instead of the card title and the column it was heading for.

import { describe, it, expect } from 'vitest';
import { createAnnouncements } from '../lib/dnd-announcements';
import type { Column } from '../lib/types';

const columns = [
  {
    id: 'col-todo',
    boardId: 'b1',
    title: 'To Do',
    position: 1,
    tasks: [
      { id: 'task-1', columnId: 'col-todo', title: 'Wire up CI', description: null, position: 1 },
      { id: 'task-2', columnId: 'col-todo', title: 'Ship it', description: null, position: 2 },
    ],
  },
  {
    id: 'col-done',
    boardId: 'b1',
    title: 'Done',
    position: 2,
    tasks: [],
  },
] as unknown as Column[];

const announcements = createAnnouncements(columns);

describe('ISSUE-003: drag announcements name real things', () => {
  it('names the card on pickup and explains the controls', () => {
    const msg = announcements.onDragStart({ active: { id: 'task-1' } });

    expect(msg).toContain('"Wire up CI"');
    expect(msg).toContain('arrow keys');
    expect(msg).not.toMatch(/task-1|col-/);
  });

  it('names the column when hovering an empty column', () => {
    const msg = announcements.onDragOver({
      active: { id: 'task-1' },
      over: { id: 'col-done' },
    });

    expect(msg).toBe('Card "Wire up CI" is over column "Done".');
  });

  it('gives position and total when hovering another card', () => {
    const msg = announcements.onDragOver({
      active: { id: 'task-1' },
      over: { id: 'task-2' },
    });

    expect(msg).toBe('Card "Wire up CI" is over position 2 of 2 in column "To Do".');
  });

  it('confirms the destination on drop', () => {
    const msg = announcements.onDragEnd({
      active: { id: 'task-1' },
      over: { id: 'col-done' },
    });

    expect(msg).toBe('Dropped card "Wire up CI" into column "Done".');
  });

  it('says the card went back when dropped outside any column', () => {
    const msg = announcements.onDragEnd({ active: { id: 'task-1' }, over: null });

    expect(msg).toContain('returned to where it started');
  });

  it('says the card went back on cancel', () => {
    const msg = announcements.onDragCancel({ active: { id: 'task-1' } });

    expect(msg).toBe('Cancelled. Card "Wire up CI" returned to where it started.');
  });

  it('never leaks a raw id, even for ids it cannot resolve', () => {
    const start = announcements.onDragStart({ active: { id: 'ghost-id' } });
    const over = announcements.onDragOver({
      active: { id: 'ghost-id' },
      over: { id: 'another-ghost' },
    });

    expect(start).not.toContain('ghost-id');
    expect(over).not.toContain('ghost-id');
    expect(over).not.toContain('another-ghost');
    expect(over).toBe('Card card is over the board.');
  });

  it('reads a live board, so a card moved between columns is described by its new home', () => {
    // handleDragOver relocates the task in local state mid-drag; the announcer
    // is rebuilt from that state, so it must follow the card.
    const moved = [
      { ...columns[0], tasks: [columns[0].tasks[1]] },
      { ...columns[1], tasks: [{ ...columns[0].tasks[0], columnId: 'col-done' }] },
    ] as unknown as Column[];

    const msg = createAnnouncements(moved).onDragOver({
      active: { id: 'task-1' },
      over: { id: 'task-1' },
    });

    expect(msg).toBe('Card "Wire up CI" is over position 1 of 1 in column "Done".');
  });
});
