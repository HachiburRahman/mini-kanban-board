import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type BoardRole = 'OWNER' | 'MEMBER';

@Injectable()
export class BoardAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads a board and confirms the given user may see it (owner or a shared
   * member). "Board doesn't exist" and "board exists but you have no access"
   * both come back as the same 404 Not Found - deliberately, so a user
   * probing board ids at random can't tell which ones exist (no cross-board
   * enumeration).
   */
  async assertAccess(userId: string, boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: { members: true },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const isOwner = board.ownerId === userId;
    const isMember = board.members.some((member: { userId: string }) => member.userId === userId);

    if (!isOwner && !isMember) {
      throw new NotFoundException('Board not found');
    }

    return { board, role: (isOwner ? 'OWNER' : 'MEMBER') as BoardRole };
  }

  /** Same access check, but only the board owner may proceed. */
  async assertOwner(userId: string, boardId: string) {
    const { board, role } = await this.assertAccess(userId, boardId);
    if (role !== 'OWNER') {
      throw new ForbiddenException('Only the board owner can do this');
    }
    return board;
  }
}
