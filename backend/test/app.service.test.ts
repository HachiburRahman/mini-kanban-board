import { describe, it, expect, vi } from 'vitest';
import { AppService } from '../src/app.service.js';

function makeService(queryRaw: () => Promise<unknown>) {
  return new AppService({ $queryRaw: vi.fn(queryRaw) } as never);
}

describe('AppService.getHealth', () => {
  it('reports ok and names the service when the database answers', async () => {
    const health = await makeService(() => Promise.resolve([{ '?column?': 1 }])).getHealth();

    expect(health).toMatchObject({
      status: 'ok',
      service: 'mini-kanban-board-api',
      database: 'up',
    });
  });

  it('reports degraded rather than throwing when the database is unreachable', async () => {
    const health = await makeService(() => Promise.reject(new Error('ECONNREFUSED'))).getHealth();

    expect(health).toMatchObject({ status: 'degraded', database: 'down' });
  });

  it('includes a whole-second uptime a probe can read', async () => {
    const health = await makeService(() => Promise.resolve([])).getHealth();

    expect(Number.isInteger(health.uptime)).toBe(true);
    expect(health.uptime).toBeGreaterThanOrEqual(0);
  });

  it('never leaks the greeting the Nest scaffold shipped with', async () => {
    const health = await makeService(() => Promise.resolve([])).getHealth();

    expect(JSON.stringify(health)).not.toContain('Hello World');
  });
});
