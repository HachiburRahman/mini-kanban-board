import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BoardAccessService } from './board-access.service.js';
import { CreateBoardDto } from './dto/create-board.dto.js';
import { UpdateBoardDto } from './dto/update-board.dto.js';
import { ShareBoardDto } from './dto/share-board.dto.js';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
  ) {}

  create(userId: string, dto: CreateBoardDto) {
    return this.prisma.board.create({
      data: { title: dto.title, ownerId: userId },
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.board.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, boardId: string) {
    const { board } = await this.access.assertAccess(userId, boardId);
    return this.prisma.board.findUnique({
      where: { id: board.id },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: { tasks: { orderBy: { position: 'asc' } } },
        },
        owner: { select: { id: true, email: true, name: true } },
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
  }

  async update(userId: string, boardId: string, dto: UpdateBoardDto) {
    await this.access.assertOwner(userId, boardId);
    return this.prisma.board.update({ where: { id: boardId }, data: dto });
  }

  async remove(userId: string, boardId: string) {
    await this.access.assertOwner(userId, boardId);
    await this.prisma.board.delete({ where: { id: boardId } });
    return { success: true };
  }

  async share(userId: string, boardId: string, dto: ShareBoardDto) {
    await this.access.assertOwner(userId, boardId);

    const targetUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!targetUser) {
      throw new NotFoundException('No registered user with that email');
    }
    if (targetUser.id === userId) {
      throw new ConflictException('You already own this board');
    }

    const existing = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: targetUser.id } },
    });
    if (existing) {
      throw new ConflictException('That user already has access to this board');
    }

    return this.prisma.boardMember.create({
      data: { boardId, userId: targetUser.id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async removeMember(userId: string, boardId: string, memberUserId: string) {
    await this.access.assertOwner(userId, boardId);

    // Deleting a membership row that isn't there would surface as a raw
    // Prisma P2025 (a 500). Check first so it comes back as a clean 404.
    const membership = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: memberUserId } },
    });
    if (!membership) {
      throw new NotFoundException('That user is not a member of this board');
    }

    await this.prisma.boardMember.delete({ where: { id: membership.id } });
    return { success: true };
  }
}
