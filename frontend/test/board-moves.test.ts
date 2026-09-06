import { describe, it, expect } from 'vitest';
import {
  applyColumnMove,
  applyTaskMove,
  describeKeyboardMove,
  locateTask,
  planKeyboardMove,
} from '../lib/board-moves';
import type { Column } from '../lib/types';

function makeBoard(shape: Record<string, string[]>): Column[] {
  return Object.entries(shape).map(([title, titles], c) => ({
    id: `col-${c}`,
    boardId: 'b1',
    title,
    position: (c + 1) * 1024,
    tasks: titles.map((t, i) => ({
      id: `t-${title}-${i}`,
      columnId: `col-${c}`,
      title: t,
      description: null,
      position: (i + 1) * 1024,
    })),
  }));
}

/** The order a board is in, as `{ column: [card titles] }`. */
function shapeOf(columns: Column[]) {
  return Object.fromEntries(columns.map((c) => [c.title, c.tasks.map((t) => t.title)]));
}

const board = () => makeBoard({ 'To Do': ['A', 'B', 'C'], Doing: ['D'], Done: [] });
const id = (column: string, i: number) => `t-${column}-${i}`;

describe('locateTask', () => {
  it('finds a card and reports its column and index', () => {
    expect(locateTask(board(), id('To Do', 1))).toMatchObject({ columnIndex: 0, taskIndex: 1 });
  });

  it('returns null for a card that is not on the board', () => {
    expect(locateTask(board(), 'nope')).toBeNull();
  });
});

describe('planKeyboardMove - within a column', () => {
  it('moves a card up one slot', () => {
    expect(planKeyboardMove(board(), id('To Do', 2), 'up')).toEqual({ columnId: 'col-0', index: 1 });
  });

  it('moves a card down one slot', () => {
    expect(planKeyboardMove(board(), id('To Do', 0), 'down')).toEqual({
      columnId: 'col-0',
      index: 1,
    });
  });

  it('refuses to move the top card up', () => {
    expect(planKeyboardMove(board(), id('To Do', 0), 'up')).toBeNull();
  });

  it('refuses to move the bottom card down', () => {
    expect(planKeyboardMove(board(), id('To Do', 2), 'down')).toBeNull();
  });
});

describe('planKeyboardMove - between columns', () => {
  it('carries a card into the next column at the same height', () => {
    expect(planKeyboardMove(board(), id('To Do', 0), 'right')).toEqual({
      columnId: 'col-1',
      index: 0,
    });
  });

  it('clamps to the end when the next column is shorter', () => {
    expect(planKeyboardMove(board(), id('To Do', 2), 'right')).toEqual({
      columnId: 'col-1',
      index: 1,
    });
  });

  /** The case dnd-kit's KeyboardSensor could never do: an empty target lane. */
  it('moves into an empty column', () => {
    expect(planKeyboardMove(board(), id('Doing', 0), 'right')).toEqual({
      columnId: 'col-2',
      index: 0,
    });
  });

  /** ...and the leftward direction, which the reverted coordinate-getter
   *  approach never managed at all. */
  it('moves back to the previous column', () => {
    expect(planKeyboardMove(board(), id('Doing', 0), 'left')).toEqual({
      columnId: 'col-0',
      index: 0,
    });
  });

  it('refuses to move past the first column', () => {
    expect(planKeyboardMove(board(), id('To Do', 0), 'left')).toBeNull();
  });

  it('refuses to move past the last column', () => {
    expect(planKeyboardMove(board(), id('Doing', 0), 'right')).not.toBeNull();
    expect(planKeyboardMove(makeBoard({ Only: ['A'] }), id('Only', 0), 'right')).toBeNull();
  });

  it('returns null for a card that is not on the board', () => {
    expect(planKeyboardMove(board(), 'ghost', 'right')).toBeNull();
  });
});

describe('applyTaskMove', () => {
  it('reorders within a column exactly as the plan says', () => {
    const next = applyTaskMove(board(), id('To Do', 2), { columnId: 'col-0', index: 0 });
    expect(shapeOf(next)['To Do']).toEqual(['C', 'A', 'B']);
  });

  it('moves a card to another column and removes it from the old one', () => {
    const next = applyTaskMove(board(), id('To Do', 0), { columnId: 'col-1', index: 0 });
    expect(shapeOf(next)).toEqual({ 'To Do': ['B', 'C'], Doing: ['A', 'D'], Done: [] });
  });

  it('rewrites the moved card’s columnId', () => {
    const next = applyTaskMove(board(), id('To Do', 0), { columnId: 'col-2', index: 0 });
    expect(next[2].tasks[0].columnId).toBe('col-2');
  });

  it('clamps an index past the end of the target column', () => {
    const next = applyTaskMove(board(), id('To Do', 0), { columnId: 'col-1', index: 99 });
    expect(shapeOf(next).Doing).toEqual(['D', 'A']);
  });

  it('leaves the board untouched for an unknown card', () => {
    const before = board();
    expect(shapeOf(applyTaskMove(before, 'ghost', { columnId: 'col-0', index: 0 }))).toEqual(
      shapeOf(before),
    );
  });

  it('does not mutate the columns it was given', () => {
    const before = board();
    applyTaskMove(before, id('To Do', 0), { columnId: 'col-1', index: 0 });
    expect(shapeOf(before)['To Do']).toEqual(['A', 'B', 'C']);
  });

  /**
   * The optimistic update has to land on the same arrangement the API will,
   * or the board shows one order and a reload shows another.
   */
  it('agrees with the API index contract (position among the OTHER cards)', () => {
    const columns = board();
    const plan = planKeyboardMove(columns, id('To Do', 0), 'down')!;
    const next = applyTaskMove(columns, id('To Do', 0), plan);

    const others = columns[0].tasks.filter((t) => t.id !== id('To Do', 0)).map((t) => t.title);
    const expected = [...others.slice(0, plan.index), 'A', ...others.slice(plan.index)];
    expect(shapeOf(next)['To Do']).toEqual(expected);
  });
});

describe('applyColumnMove', () => {
  it('moves a column left', () => {
    expect(Object.keys(shapeOf(applyColumnMove(board(), 'col-1', 0)))).toEqual([
      'Doing',
      'To Do',
      'Done',
    ]);
  });

  it('moves a column right', () => {
    expect(Object.keys(shapeOf(applyColumnMove(board(), 'col-0', 1)))).toEqual([
      'Doing',
      'To Do',
      'Done',
    ]);
  });

  it('clamps an index past the end', () => {
    expect(Object.keys(shapeOf(applyColumnMove(board(), 'col-0', 99)))).toEqual([
      'Doing',
      'Done',
      'To Do',
    ]);
  });

  it('carries the column’s cards with it', () => {
    expect(shapeOf(applyColumnMove(board(), 'col-0', 2))['To Do']).toEqual(['A', 'B', 'C']);
  });

  it('leaves the board untouched for an unknown column', () => {
    const before = board();
    expect(shapeOf(applyColumnMove(before, 'ghost', 0))).toEqual(shapeOf(before));
  });
});

describe('describeKeyboardMove', () => {
  it('names the card, its position and its column', () => {
    const next = applyTaskMove(board(), id('To Do', 0), { columnId: 'col-1', index: 1 });
    expect(describeKeyboardMove(next, id('To Do', 0))).toBe(
      'Moved "A" to position 2 of 2 in column "Doing".',
    );
  });

  it('never leaks a raw record id', () => {
    expect(describeKeyboardMove(board(), 'cmtlsw49h000k4fisb9udwmb0')).not.toContain('cmtlsw');
  });
});
