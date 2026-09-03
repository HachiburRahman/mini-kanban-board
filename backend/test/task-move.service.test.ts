import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskMoveService } from '../src/tasks/task-move.service.js';

interface Sibling {
  id: string;
  position: number;
}

/**
 * Builds a TaskMoveService whose prisma is a fake that runs the transaction
 * callback inline. `update` is captured so each test can assert the exact
 * position the fractional-index maths produced.
 */
function makeService(opts: {
  task?: { id: string; columnId: string; column: { boardId: string } } | null;
  targetColumn?: { id: string; boardId: string } | null;
  siblings?: Sibling[];
}) {
  const task =
    opts.task === undefined
      ? { id: 't1', columnId: 'c1', column: { boardId: 'b1' } }
      : opts.task;
  const targetColumn =
    opts.targetColumn === undefined ? { id: 'c1', boardId: 'b1' } : opts.targetColumn;
  const siblings = opts.siblings ?? [];

  const update = vi.fn(({ data }) => Promise.resolve({ id: 't1', ...data }));

  const tx = {
    column: { findUnique: vi.fn().mockResolvedValue(targetColumn) },
    task: {
      findMany: vi.fn().mockResolvedValue([...siblings].sort((a, b) => a.position - b.position)),
      update,
    },
  };

  const prisma = {
    task: { findUnique: vi.fn().mockResolvedValue(task) },
    $transaction: vi.fn((cb: (t: unknown) => unknown) => cb(tx)),
  };

  const access = { assertAccess: vi.fn().mockResolvedValue({ role: 'OWNER' }) };

  return {
    service: new TaskMoveService(prisma as never, access as never),
    update,
    access,
    tx,
  };
}

describe('TaskMoveService.move - fractional position maths', () => {
  it('seeds position 1024 for the first task in an empty column', async () => {
    const { service, update } = makeService({ siblings: [] });

    await service.move('u1', 't1', { index: 0 });

    expect(update.mock.calls[0][0].data.position).toBe(1024);
  });

  it('halves the first position when dropping at the top', async () => {
    const { service, update } = makeService({
      siblings: [
        { id: 'a', position: 100 },
        { id: 'b', position: 200 },
      ],
    });

    await service.move('u1', 't1', { index: 0 });

    expect(update.mock.calls[0][0].data.position).toBe(50);
  });

  it('averages the two neighbours when dropping in the middle', async () => {
    const { service, update } = makeService({
      siblings: [
        { id: 'a', position: 100 },
        { id: 'b', position: 200 },
      ],
    });

    await service.move('u1', 't1', { index: 1 });

    expect(update.mock.calls[0][0].data.position).toBe(150);
  });

  it('adds 1 past the last position when dropping at the bottom', async () => {
    const { service, update } = makeService({
      siblings: [
        { id: 'a', position: 100 },
        { id: 'b', position: 200 },
      ],
    });

    await service.move('u1', 't1', { index: 2 });

    expect(update.mock.calls[0][0].data.position).toBe(201);
  });

  it('clamps an index past the end instead of throwing', async () => {
    // The client can send a stale index if another user removed a card first.
    const { service, update } = makeService({
      siblings: [{ id: 'a', position: 100 }],
    });

    await service.move('u1', 't1', { index: 99 });

    expect(update.mock.calls[0][0].data.position).toBe(101);
  });

  it('clamps a negative index to the top of the column', async () => {
    const { service, update } = makeService({
      siblings: [{ id: 'a', position: 100 }],
    });

    await service.move('u1', 't1', { index: -5 });

    expect(update.mock.calls[0][0].data.position).toBe(50);
  });
});

describe('TaskMoveService.move - guards', () => {
  it('throws NotFound for a task id that does not exist', async () => {
    const { service } = makeService({ task: null });

    await expect(service.move('u1', 'nope', { index: 0 })).rejects.toThrow(NotFoundException);
  });

  it('checks board access before touching any ordering', async () => {
    const { service, access } = makeService({ siblings: [] });

    await service.move('u1', 't1', { index: 0 });

    expect(access.assertAccess).toHaveBeenCalledWith('u1', 'b1');
  });

  it('refuses to move a task into a column on a different board', async () => {
    const { service } = makeService({
      targetColumn: { id: 'c9', boardId: 'OTHER-BOARD' },
    });

    await expect(service.move('u1', 't1', { index: 0, columnId: 'c9' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFound when the target column does not exist', async () => {
    const { service } = makeService({ targetColumn: null });

    await expect(service.move('u1', 't1', { index: 0, columnId: 'ghost' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('excludes the moving task from its own neighbour calculation', async () => {
    // Same-column reorder: if the task counted itself as a sibling, the
    // averaged position would be computed against its own old slot.
    const { service, tx } = makeService({ siblings: [{ id: 'a', position: 100 }] });

    await service.move('u1', 't1', { index: 1 });

    expect(tx.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { columnId: 'c1', id: { not: 't1' } } }),
    );
  });
});
