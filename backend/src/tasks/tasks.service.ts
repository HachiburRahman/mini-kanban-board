import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BoardAccessService } from '../boards/board-access.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

@Injectable()
export class TasksService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly access: BoardAccessService,
  ) {}

  private async loadColumnOrThrow(columnId: string) {
    const column = await this.prisma.column.findUnique({ where: { id: columnId } });
    if (!column) {
      throw new NotFoundException('Column not found');
    }
    return column;
  }

  async loadTaskOrThrow(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { column: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async create(userId: string, columnId: string, dto: CreateTaskDto) {
    const column = await this.loadColumnOrThrow(columnId);
    await this.access.assertAccess(userId, column.boardId);

    const { _max } = await this.prisma.task.aggregate({
      where: { columnId },
      _max: { position: true },
    });

    return this.prisma.task.create({
      data: {
        columnId,
        title: dto.title,
        description: dto.description,
        position: (_max.position ?? 0) + 1,
      },
    });
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.loadTaskOrThrow(taskId);
    await this.access.assertAccess(userId, task.column.boardId);
    return this.prisma.task.update({ where: { id: taskId }, data: dto });
  }

  async remove(userId: string, taskId: string) {
    const task = await this.loadTaskOrThrow(taskId);
    await this.access.assertAccess(userId, task.column.boardId);
    await this.prisma.task.delete({ where: { id: taskId } });
    return { success: true };
  }
}
