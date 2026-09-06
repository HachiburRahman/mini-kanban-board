import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ColumnMoveService } from '../src/columns/column-move.service.js';

interface Sibling {
  id: string;
  position: number;
}

/**
 * Builds a ColumnMoveService whose prisma is a fake that runs the transaction
 * callback inline, mirroring the TaskMoveService harness.
 */
function makeService(opts: {
  column?: { id: string; boardId: string } | null;
  siblings?: Sibling[];
}) {
  const column = opts.column === undefined ? { id: 'c1', boardId: 'b1' } : opts.column;
  const siblings = opts.siblings ?? [];

  const update = vi.fn(({ where, data }) => Promise.resolve({ id: where.id, ...data }));

  const tx = {
    column: {
      findMany: vi.fn().mockResolvedValue([...siblings].sort((a, b) => a.position - b.position)),
      update,
    },
  };

  const prisma = {
    column: { findUnique: vi.fn().mockResolvedValue(column) },
    $transaction: vi.fn((cb: (t: unknown) => unknown) => cb(tx)),
  };

  const access = { assertAccess: vi.fn().mockResolvedValue({ role: 'OWNER' }) };

  return { service: new ColumnMoveService(prisma as never, access as never), update, access, tx };
}

describe('ColumnMoveService.move', () => {
  it('seeds position 1024 for the only column on a board', async () => {
    const { service, update } = makeService({ siblings: [] });

    await service.move('u1', 'c1', { index: 0 });

    expect(update.mock.calls[0][0].data.position).toBe(1024);
  });

  it('halves the first position when moving a column to the far left', async () => {
    const { service, update } = makeService({
      siblings: [
        { id: 'a', position: 100 },
        { id: 'b', position: 200 },
      ],
    });

    await service.move('u1', 'c1', { index: 0 });

    expect(update.mock.calls[0][0].data.position).toBe(50);
  });

  it('averages the neighbours when moving a column between two others', async () => {
    const { service, update } = makeService({
      siblings: [
        { id: 'a', position: 100 },
        { id: 'b', position: 200 },
      ],
    });

    await service.move('u1', 'c1', { index: 1 });

    expect(update.mock.calls[0][0].data.position).toBe(150);
  });

  it('moves past the last column when asked for the far right', async () => {
    const { service, update } = makeService({ siblings: [{ id: 'a', position: 100 }] });

    await service.move('u1', 'c1', { index: 1 });

    expect(update.mock.calls[0][0].data.position).toBe(101);
  });

  it('clamps an index past the end instead of throwing', async () => {
    const { service, update } = makeService({ siblings: [{ id: 'a', position: 100 }] });

    await service.move('u1', 'c1', { index: 99 });

    expect(update.mock.calls[0][0].data.position).toBe(101);
  });

  it('excludes the moving column from its own neighbour calculation', async () => {
    const { service, tx } = makeService({ siblings: [{ id: 'a', position: 100 }] });

    await service.move('u1', 'c1', { index: 0 });

    expect(tx.column.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boardId: 'b1', id: { not: 'c1' } } }),
    );
  });

  it('throws NotFound for a column id that does not exist', async () => {
    const { service } = makeService({ column: null });

    await expect(service.move('u1', 'missing', { index: 0 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('checks board access before touching any ordering', async () => {
    const { service, access, tx } = makeService({ siblings: [] });

    await service.move('u1', 'c1', { index: 0 });

    expect(access.assertAccess).toHaveBeenCalledWith('u1', 'b1');
    expect(access.assertAccess.mock.invocationCallOrder[0]).toBeLessThan(
      tx.column.findMany.mock.invocationCallOrder[0],
    );
  });

  it('refuses to reorder a column on a board the user cannot reach', async () => {
    const { service, tx } = makeService({ siblings: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).access.assertAccess = vi.fn().mockRejectedValue(new NotFoundException());

    await expect(service.move('outsider', 'c1', { index: 0 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.column.update).not.toHaveBeenCalled();
  });
});

describe('ColumnMoveService.move - renumbering', () => {
  it('renumbers the board when the gap between columns is exhausted', async () => {
    const { service, update } = makeService({
      siblings: [
        { id: 'a', position: 1 },
        { id: 'b', position: 1 + 1e-9 },
      ],
    });

    await service.move('u1', 'c1', { index: 1 });

    expect(update.mock.calls.map((c) => [c[0].where.id, c[0].data.position])).toEqual([
      ['a', 1024],
      ['b', 3072],
      ['c1', 2048],
    ]);
  });

  it('preserves the visible order when it renumbers', async () => {
    const { service, update } = makeService({
      siblings: [
        { id: 'a', position: 1 },
        { id: 'b', position: 1 + 1e-9 },
      ],
    });

    await service.move('u1', 'c1', { index: 1 });

    const byPosition = update.mock.calls
      .map((c) => ({ id: c[0].where.id, position: c[0].data.position }))
      .sort((x, y) => x.position - y.position)
      .map((x) => x.id);
    expect(byPosition).toEqual(['a', 'c1', 'b']);
  });
});
