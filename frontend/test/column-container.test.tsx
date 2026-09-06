import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { ColumnContainer } from '../components/ColumnContainer';
import type { Column } from '../lib/types';

const column: Column = {
  id: 'c1',
  boardId: 'b1',
  title: 'To Do',
  position: 1024,
  tasks: [
    { id: 't1', columnId: 'c1', title: 'Write the README', description: null, position: 1024 },
  ],
};

function renderColumn(overrides: { index?: number; columnCount?: number } = {}) {
  const handlers = {
    onAddTask: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onEditTask: vi.fn(),
    onKeyboardMove: vi.fn(),
  };
  render(
    <DndContext>
      <ColumnContainer
        column={column}
        index={overrides.index ?? 1}
        columnCount={overrides.columnCount ?? 3}
        {...handlers}
      />
    </DndContext>,
  );
  return { ...handlers, user: userEvent.setup() };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Column actions for To Do' }));
}

describe('column menu', () => {
  it('renames the column when Enter commits the field', async () => {
    const { onRename, user } = renderColumn();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Rename column' }));
    const field = screen.getByLabelText('Rename column');
    await user.clear(field);
    await user.type(field, 'Backlog{Enter}');

    expect(onRename).toHaveBeenCalledWith('c1', 'Backlog');
  });

  /**
   * The rename form has no submit button, and implicit submission on Enter is
   * not something every browser does in that case - so Enter is handled
   * explicitly rather than left to the form.
   */
  it('does not rely on the form having a submit button', async () => {
    const { user } = renderColumn();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Rename column' }));

    const form = screen.getByLabelText('Rename column').closest('form')!;
    expect(form.querySelector('button[type="submit"], input[type="submit"]')).toBeNull();
  });

  it('abandons the edit on Escape rather than saving the draft', async () => {
    const { onRename, user } = renderColumn();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Rename column' }));
    const field = screen.getByLabelText('Rename column');
    await user.clear(field);
    await user.type(field, 'Discard me{Escape}');

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'To Do' })).toBeInTheDocument();
  });

  it('saves on blur, so clicking away is not a silent loss', async () => {
    const { onRename, user } = renderColumn();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Rename column' }));
    const field = screen.getByLabelText('Rename column');
    await user.clear(field);
    await user.type(field, 'Backlog');
    await user.tab();

    expect(onRename).toHaveBeenCalledWith('c1', 'Backlog');
  });

  it('ignores a rename that changes nothing', async () => {
    const { onRename, user } = renderColumn();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Rename column' }));
    await user.type(screen.getByLabelText('Rename column'), '{Enter}');

    expect(onRename).not.toHaveBeenCalled();
  });

  it('ignores a rename to whitespace', async () => {
    const { onRename, user } = renderColumn();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Rename column' }));
    const field = screen.getByLabelText('Rename column');
    await user.clear(field);
    await user.type(field, '   {Enter}');

    expect(onRename).not.toHaveBeenCalled();
  });

  it('moves the column left and right by index', async () => {
    const { onMove, user } = renderColumn({ index: 1, columnCount: 3 });

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Move left' }));
    expect(onMove).toHaveBeenCalledWith('c1', 0);

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Move right' }));
    expect(onMove).toHaveBeenCalledWith('c1', 2);
  });

  it('disables "Move left" on the first column', async () => {
    const { user } = renderColumn({ index: 0, columnCount: 3 });

    await openMenu(user);

    expect(screen.getByRole('menuitem', { name: 'Move left' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Move right' })).toBeEnabled();
  });

  it('disables "Move right" on the last column', async () => {
    const { user } = renderColumn({ index: 2, columnCount: 3 });

    await openMenu(user);

    expect(screen.getByRole('menuitem', { name: 'Move right' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Move left' })).toBeEnabled();
  });

  it('hands the whole column to the delete handler, so it can warn about the cards', async () => {
    const { onDelete, user } = renderColumn();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Delete column' }));

    expect(onDelete).toHaveBeenCalledWith(column);
  });

  it('closes on Escape and hands focus back to the trigger', async () => {
    const { user } = renderColumn();

    await openMenu(user);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Column actions for To Do' })).toHaveFocus();
  });
});

describe('adding a card', () => {
  it('adds a card and keeps the composer open for the next one', async () => {
    const { onAddTask, user } = renderColumn();

    await user.click(screen.getByRole('button', { name: /Add card/ }));
    await user.type(screen.getByLabelText('New card in To Do'), 'Ship it{Enter}');

    expect(onAddTask).toHaveBeenCalledWith('c1', 'Ship it');
    expect(screen.getByLabelText('New card in To Do')).toHaveValue('');
  });

  it('will not add a blank card', async () => {
    const { onAddTask, user } = renderColumn();

    await user.click(screen.getByRole('button', { name: /Add card/ }));
    await user.type(screen.getByLabelText('New card in To Do'), '   {Enter}');

    expect(onAddTask).not.toHaveBeenCalled();
  });
});
