import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BoardAccessService } from '../boards/board-access.service.js';
import { CreateColumnDto } from './dto/create-column.dto.js';
import { UpdateColumnDto } from './dto/update-column.dto.js';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
  ) {}

  async create(userId: string, boardId: string, dto: CreateColumnDto) {
    await this.access.assertAccess(userId, boardId);

    const { _max } = await this.prisma.column.aggregate({
      where: { boardId },
      _max: { position: true },
    });

    return this.prisma.column.create({
      data: { boardId, title: dto.title, position: (_max.position ?? 0) + 1 },
    });
  }

  private async loadColumnOrThrow(columnId: string) {
    const column = await this.prisma.column.findUnique({ where: { id: columnId } });
    if (!column) {
      throw new NotFoundException('Column not found');
    }
    return column;
  }

  async update(userId: string, columnId: string, dto: UpdateColumnDto) {
    const column = await this.loadColumnOrThrow(columnId);
    await this.access.assertAccess(userId, column.boardId);
    return this.prisma.column.update({ where: { id: columnId }, data: dto });
  }

  async remove(userId: string, columnId: string) {
    const column = await this.loadColumnOrThrow(columnId);
    await this.access.assertAccess(userId, column.boardId);
    await this.prisma.column.delete({ where: { id: columnId } });
    return { success: true };
  }
}
