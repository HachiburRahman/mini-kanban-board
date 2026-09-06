// Regression: ISSUE-012 — a cancelled drag left the board showing a move that
// never happened
// Found during QA on 2026-09-06
//
// `handleDragOver` moves a card into the hovered column immediately so the
// drag reads well. dnd-kit fires `onDragCancel` (Escape) rather than
// `onDragEnd`, and the board had no `onDragCancel` at all — so the preview
// stayed, no request was sent, and the announcer said the card "returned to
// where it started" while it visibly had not. Reproduced live: card in To Do,
// hover In Progress, Escape → UI showed In Progress, the API still had To Do.
//
// The same hole swallowed a drop on nothing at all (`over === null`).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { DragOverEvent } from '@dnd-kit/core';

// `useRouter` and `useParams` must hand back the SAME object every render:
// the page keys `load` off them, so a fresh object each call would re-run the
// fetch effect forever.
const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  params: { boardId: 'b1' },
  getBoard: vi.fn(),
  moveTask: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => mocks.params,
  useRouter: () => mocks.router,
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: { getBoard: mocks.getBoard, moveTask: mocks.moveTask },
  };
});

const { getBoard, moveTask } = mocks;

/**
 * Swap DndContext for a plain wrapper that captures the handlers the page
 * passes it. jsdom has no layout, so a real drag can't be simulated - but the
 * handlers themselves are the thing under test, and they run against the
 * page's real state.
 */
let handlers: Record<string, (event: unknown) => void> = {};

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children, ...props }: { children: React.ReactNode }) => {
      handlers = props as typeof handlers;
      return <>{children}</>;
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import BoardPage from '../app/boards/[boardId]/page';

const board = () => ({
  id: 'b1',
  title: 'Roadmap',
  ownerId: 'u1',
  createdAt: '2026-09-06T00:00:00.000Z',
  owner: { id: 'u1', email: 'a@b.dev', name: 'Ada' },
  members: [],
  columns: [
    {
      id: 'todo',
      boardId: 'b1',
      title: 'To Do',
      position: 1024,
      tasks: [
        {
          id: 't1',
          columnId: 'todo',
          title: 'Write the README',
          description: null,
          position: 1024,
        },
      ],
    },
    { id: 'doing', boardId: 'b1', title: 'In Progress', position: 2048, tasks: [] },
  ],
});

/** `{ column: [card titles] }`, read back out of the rendered DOM. */
function renderedShape() {
  return Object.fromEntries(
    [...document.querySelectorAll('section[aria-label]')].map((section) => [
      section.getAttribute('aria-label'),
      [...section.querySelectorAll('article')].map((a) => a.querySelector('p')?.textContent),
    ]),
  );
}

const hoverOtherColumn = {
  active: { id: 't1' },
  over: { id: 'doing' },
} as unknown as DragOverEvent;

beforeEach(() => {
  handlers = {};
  moveTask.mockReset().mockResolvedValue({});
  getBoard.mockReset().mockImplementation(() => Promise.resolve(board()));
  localStorage.setItem('kanban_token', 'tok');
  localStorage.setItem('kanban_user', JSON.stringify({ id: 'u1', email: 'a@b.dev', name: 'Ada' }));
});

afterEach(() => localStorage.clear());

async function renderBoard() {
  render(<BoardPage />);
  await screen.findByRole('heading', { name: 'Roadmap', level: 1 });
}

describe('ISSUE-012: a cancelled drag puts the card back', () => {
  it('previews the cross-column move while the card is over the other lane', async () => {
    await renderBoard();

    await act(async () => handlers.onDragStart({ active: { id: 't1' } }));
    await act(async () => handlers.onDragOver(hoverOtherColumn));

    await waitFor(() =>
      expect(renderedShape()).toEqual({ 'To Do': [], 'In Progress': ['Write the README'] }),
    );
  });

  it('restores the original arrangement when the drag is cancelled', async () => {
    await renderBoard();

    await act(async () => handlers.onDragStart({ active: { id: 't1' } }));
    await act(async () => handlers.onDragOver(hoverOtherColumn));
    await waitFor(() => expect(renderedShape()['In Progress']).toHaveLength(1));

    await act(async () => handlers.onDragCancel({ active: { id: 't1' } }));

    await waitFor(() =>
      expect(renderedShape()).toEqual({ 'To Do': ['Write the README'], 'In Progress': [] }),
    );
  });

  it('sends nothing to the server for a cancelled drag', async () => {
    await renderBoard();

    await act(async () => handlers.onDragStart({ active: { id: 't1' } }));
    await act(async () => handlers.onDragOver(hoverOtherColumn));
    await act(async () => handlers.onDragCancel({ active: { id: 't1' } }));

    await waitFor(() => expect(renderedShape()['To Do']).toHaveLength(1));
    expect(moveTask).not.toHaveBeenCalled();
  });

  it('restores the original arrangement when the card is dropped on nothing', async () => {
    await renderBoard();

    await act(async () => handlers.onDragStart({ active: { id: 't1' } }));
    await act(async () => handlers.onDragOver(hoverOtherColumn));
    await waitFor(() => expect(renderedShape()['In Progress']).toHaveLength(1));

    await act(async () => handlers.onDragEnd({ active: { id: 't1' }, over: null }));

    await waitFor(() =>
      expect(renderedShape()).toEqual({ 'To Do': ['Write the README'], 'In Progress': [] }),
    );
    expect(moveTask).not.toHaveBeenCalled();
  });

  it('still commits a real drop, so the revert path did not break moving cards', async () => {
    await renderBoard();

    await act(async () => handlers.onDragStart({ active: { id: 't1' } }));
    await act(async () => handlers.onDragOver(hoverOtherColumn));
    await waitFor(() => expect(renderedShape()['In Progress']).toHaveLength(1));

    await act(async () => handlers.onDragEnd({ active: { id: 't1' }, over: { id: 'doing' } }));

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith('t1', { columnId: 'doing', index: 0 }));
    expect(renderedShape()).toEqual({ 'To Do': [], 'In Progress': ['Write the README'] });
  });

  it('puts the card back and refetches when the server rejects the move', async () => {
    const { ApiError } = await vi.importActual<typeof import('../lib/api')>('../lib/api');
    moveTask.mockRejectedValueOnce(new ApiError(409, 'Someone else moved that card.'));
    await renderBoard();

    await act(async () => handlers.onDragStart({ active: { id: 't1' } }));
    await act(async () => handlers.onDragOver(hoverOtherColumn));
    await waitFor(() => expect(renderedShape()['In Progress']).toHaveLength(1));

    await act(async () => handlers.onDragEnd({ active: { id: 't1' }, over: { id: 'doing' } }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else moved that card.');
    await waitFor(() => expect(getBoard).toHaveBeenCalledTimes(2));
  });
});
