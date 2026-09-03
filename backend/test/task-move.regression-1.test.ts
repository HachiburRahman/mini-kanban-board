// Regression: ISSUE-005 — fractional `position` halves toward zero and ties
// Found by /qa on 2026-09-03
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-09-03.md
//
// Measured during QA: 120 drops at the top of one column took `position` from
// 1024 to 6.9e-18, halving every move. At ~1080 moves it reaches 0, after which
// `after / 2` is also 0 - cards tie and reordering silently stops working.

import { describe, it, expect, vi } from 'vitest';
import { TaskMoveService } from '../src/tasks/task-move.service.js';

interface Sibling {
  id: string;
  position: number;
}

function makeService(siblings: Sibling[]) {
  const updates: { id: string; data: Record<string, unknown> }[] = [];

  const tx = {
    column: { findUnique: vi.fn().mockResolvedValue({ id: 'c1', boardId: 'b1' }) },
    task: {
      findMany: vi.fn().mockResolvedValue([...siblings].sort((a, b) => a.position - b.position)),
      update: vi.fn(({ where, data }) => {
        updates.push({ id: where.id, data });
        return Promise.resolve({ id: where.id, ...data });
      }),
    },
  };

  const prisma = {
    task: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 't1', columnId: 'c1', column: { boardId: 'b1' } }),
    },
    $transaction: vi.fn((cb: (t: unknown) => unknown) => cb(tx)),
  };

  const access = { assertAccess: vi.fn().mockResolvedValue({ role: 'OWNER' }) };

  return { service: new TaskMoveService(prisma as never, access as never), updates };
}

describe('ISSUE-005: healthy gaps still use fractional indexing', () => {
  it('does not renumber when there is room between neighbours', async () => {
    const { service, updates } = makeService([
      { id: 'a', position: 100 },
      { id: 'b', position: 200 },
    ]);

    await service.move('u1', 't1', { index: 1 });

    // One write only: the moving card. Everything else is left alone.
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ id: 't1', data: { position: 150 } });
  });

  it('does not renumber for a normal drop at the top', async () => {
    const { service, updates } = makeService([{ id: 'a', position: 1024 }]);

    await service.move('u1', 't1', { index: 0 });

    expect(updates).toHaveLength(1);
    expect(updates[0].data.position).toBe(512);
  });
});

describe('ISSUE-005: collapsing gaps trigger a renumber', () => {
  it('renumbers when the gap between neighbours is exhausted', async () => {
    // The state repeated top-drops eventually produce.
    const { service, updates } = makeService([
      { id: 'a', position: 1e-18 },
      { id: 'b', position: 2e-18 },
    ]);

    await service.move('u1', 't1', { index: 1 });

    // Every card in the column gets a fresh, evenly spaced position.
    expect(updates).toHaveLength(3);
    const byId = Object.fromEntries(updates.map((u) => [u.id, u.data.position]));
    expect(byId).toEqual({ a: 1024, t1: 2048, b: 3072 });
  });

  it('renumbers when the headroom below the first card is exhausted', async () => {
    const { service, updates } = makeService([{ id: 'a', position: 1e-18 }]);

    await service.move('u1', 't1', { index: 0 });

    expect(updates).toHaveLength(2);
    const byId = Object.fromEntries(updates.map((u) => [u.id, u.data.position]));
    expect(byId).toEqual({ t1: 1024, a: 2048 });
  });

  it('preserves the visible order when it renumbers', async () => {
    const { service, updates } = makeService([
      { id: 'a', position: 1e-18 },
      { id: 'b', position: 2e-18 },
      { id: 'c', position: 3e-18 },
    ]);

    await service.move('u1', 't1', { index: 2 });

    const ordered = updates
      .slice()
      .sort((x, y) => (x.data.position as number) - (y.data.position as number))
      .map((u) => u.id);
    expect(ordered).toEqual(['a', 'b', 't1', 'c']);
  });

  it('never writes a zero or negative position', async () => {
    const { service, updates } = makeService([
      { id: 'a', position: Number.MIN_VALUE },
      { id: 'b', position: Number.MIN_VALUE * 2 },
    ]);

    await service.move('u1', 't1', { index: 0 });

    for (const u of updates) {
      expect(u.data.position as number).toBeGreaterThan(0);
    }
  });

  it('still moves the card to the target column while renumbering', async () => {
    const { service, updates } = makeService([{ id: 'a', position: 1e-18 }]);

    await service.move('u1', 't1', { index: 0, columnId: 'c1' });

    const moved = updates.find((u) => u.id === 't1');
    expect(moved?.data.columnId).toBe('c1');
  });

  it('survives the full 1200-move top-drop loop that broke ordering', async () => {
    // Replay the real failure: keep dropping at index 0 and feed each result
    // back in. Without renumbering, position reaches 0 and cards tie.
    let siblings: Sibling[] = [{ id: 'a', position: 1024 }];

    for (let i = 0; i < 1200; i++) {
      const { service, updates } = makeService(siblings);
      await service.move('u1', 't1', { index: 0 });

      const next = new Map(siblings.map((s) => [s.id, s.position]));
      for (const u of updates) next.set(u.id, u.data.position as number);

      // 't1' becomes the head; keep one trailing sibling so the loop is stable.
      const head = next.get('t1')!;
      expect(head).toBeGreaterThan(0);
      siblings = [{ id: 'a', position: head }];
    }

    expect(siblings[0].position).toBeGreaterThan(0);
  });
});
