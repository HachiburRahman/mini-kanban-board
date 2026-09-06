// Covers the keyboard affordance added for ISSUE-002 — keyboard users could
// not move a card between columns.
//
// dnd-kit's KeyboardSensor reads the lane's live geometry after the coordinate
// getter returns, and scrolls the lane INSTEAD of moving the card whenever the
// requested x sits past the scroll container's midpoint. The board lane is
// always horizontally scrollable, so that branch fired for every column not
// already at the left edge. Four coordinate-getter approaches were tried and
// reverted. Ctrl/Cmd + arrow replaces the simulated pointer maths with a plain
// index calculation feeding the same moveTask call the drag uses.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { TaskCard } from '../components/TaskCard';
import type { Task } from '../lib/types';

const task: Task = {
  id: 't1',
  columnId: 'c1',
  title: 'Ship the share panel',
  description: null,
  position: 1024,
};

function renderCard(props: Partial<Parameters<typeof TaskCard>[0]> = {}) {
  const onKeyboardMove = vi.fn();
  const onEdit = vi.fn();
  render(
    <DndContext>
      <SortableContext items={[task.id]}>
        <TaskCard task={task} onKeyboardMove={onKeyboardMove} onEdit={onEdit} {...props} />
      </SortableContext>
    </DndContext>,
  );
  // dnd-kit's sortable attributes put role="button" on the card, so reach for
  // it by the hook the board uses to refocus it rather than by role.
  const card = document.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`)!;
  return { onKeyboardMove, onEdit, card };
}

async function press(card: HTMLElement, combo: string) {
  const user = userEvent.setup();
  card.focus();
  await user.keyboard(combo);
}

describe('ISSUE-002: a focused card can be moved with the keyboard', () => {
  it.each([
    ['{Control>}{ArrowRight}{/Control}', 'right'],
    ['{Control>}{ArrowLeft}{/Control}', 'left'],
    ['{Control>}{ArrowUp}{/Control}', 'up'],
    ['{Control>}{ArrowDown}{/Control}', 'down'],
  ])('Ctrl+%s asks to move the card %s', async (combo, direction) => {
    const { onKeyboardMove, card } = renderCard();

    await press(card, combo);

    expect(onKeyboardMove).toHaveBeenCalledWith('t1', direction);
  });

  it('works with Cmd on a Mac keyboard too', async () => {
    const { onKeyboardMove, card } = renderCard();

    await press(card, '{Meta>}{ArrowRight}{/Meta}');

    expect(onKeyboardMove).toHaveBeenCalledWith('t1', 'right');
  });

  it('leaves plain arrow keys alone, so they still scroll the page', async () => {
    const { onKeyboardMove, card } = renderCard();

    await press(card, '{ArrowRight}{ArrowDown}');

    expect(onKeyboardMove).not.toHaveBeenCalled();
  });

  it('ignores other Ctrl combinations', async () => {
    const { onKeyboardMove, card } = renderCard();

    await press(card, '{Control>}a{/Control}');

    expect(onKeyboardMove).not.toHaveBeenCalled();
  });

  it('is reachable by keyboard in the first place', () => {
    const { card } = renderCard();
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('carries a stable hook the board can refocus after the card remounts', () => {
    const { card } = renderCard();
    expect(card).toHaveAttribute('data-task-id', 't1');
  });
});

describe('card editing affordance', () => {
  it('offers an edit control naming the card it belongs to', async () => {
    const { onEdit } = renderCard();

    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Edit card "Ship the share panel"' }),
    );

    expect(onEdit).toHaveBeenCalledWith(task);
  });

  it('renders a description when the card has one', () => {
    render(
      <DndContext>
        <SortableContext items={[task.id]}>
          <TaskCard task={{ ...task, description: 'Behind the Share button.' }} />
        </SortableContext>
      </DndContext>,
    );

    expect(screen.getByText('Behind the Share button.')).toBeInTheDocument();
  });

  it('drops the edit control on the drag overlay clone', () => {
    render(
      <DndContext>
        <SortableContext items={[task.id]}>
          <TaskCard task={task} overlay onEdit={vi.fn()} />
        </SortableContext>
      </DndContext>,
    );

    expect(screen.queryByRole('button', { name: /Edit card/ })).not.toBeInTheDocument();
  });
});
