import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BoardAccessService } from '../src/boards/board-access.service.js';

function makeService(board: unknown) {
  const prisma = {
    board: { findUnique: vi.fn().mockResolvedValue(board) },
  };
  return {
    service: new BoardAccessService(prisma as never),
    prisma,
  };
}

describe('BoardAccessService.assertAccess', () => {
  it('returns OWNER for the board owner', async () => {
    const { service } = makeService({ id: 'b1', ownerId: 'u1', members: [] });

    await expect(service.assertAccess('u1', 'b1')).resolves.toMatchObject({
      role: 'OWNER',
      board: { id: 'b1' },
    });
  });

  it('returns MEMBER for a user the board was shared with', async () => {
    const { service } = makeService({
      id: 'b1',
      ownerId: 'u1',
      members: [{ userId: 'u2' }],
    });

    await expect(service.assertAccess('u2', 'b1')).resolves.toMatchObject({ role: 'MEMBER' });
  });

  it('hides existing boards behind 404 so ids cannot be enumerated', async () => {
    const { service } = makeService({ id: 'b1', ownerId: 'u1', members: [{ userId: 'u2' }] });

    // A stranger must get the same error shape as a board that does not exist,
    // otherwise probing random ids reveals which boards are real.
    await expect(service.assertAccess('stranger', 'b1')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFound when the board does not exist', async () => {
    const { service } = makeService(null);

    await expect(service.assertAccess('u1', 'missing')).rejects.toThrow(NotFoundException);
  });
});

describe('BoardAccessService.assertOwner', () => {
  it('lets the owner through', async () => {
    const { service } = makeService({ id: 'b1', ownerId: 'u1', members: [] });

    await expect(service.assertOwner('u1', 'b1')).resolves.toMatchObject({ id: 'b1' });
  });

  it('rejects a shared member with Forbidden, not NotFound', async () => {
    // A member already knows the board exists, so the enumeration defence
    // does not apply here - they should get a clear "you are not the owner".
    const { service } = makeService({ id: 'b1', ownerId: 'u1', members: [{ userId: 'u2' }] });

    await expect(service.assertOwner('u2', 'b1')).rejects.toThrow(ForbiddenException);
  });
});
