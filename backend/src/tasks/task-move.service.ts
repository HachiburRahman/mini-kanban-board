import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { BoardAccessService } from '../boards/board-access.service.js';
import { MoveTaskDto } from './dto/move-task.dto.js';

const MAX_RETRIES = 3;

/**
 * Handles the one endpoint that has to get concurrency right: moving a task
 * within a column (reorder) or into a different column at a specific index.
 *
 * Ordering strategy: `position` is a float (fractional indexing). Moving a
 * task to sit between two neighbours just needs the average of their two
 * positions - no renumbering every other row in the column. Moving to the
 * very start/end just needs half the first position, or +1 past the last.
 *
 * Concurrency: the "read sibling positions, then write" sequence runs inside
 * a SERIALIZABLE Postgres transaction, so two people dragging cards on the
 * same board at the same moment can't compute stale neighbour positions and
 * collide. Postgres reports that as a serialization failure (Prisma error
 * code P2034) rather than corrupting the order, so we just retry a few times
 * with a fresh read.
 */
@Injectable()
export class TaskMoveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
  ) {}

  async move(userId: string, taskId: string, dto: MoveTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { column: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.access.assertAccess(userId, task.column.boardId);

    const targetColumnId = dto.columnId ?? task.columnId;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.reorderWithinTransaction(tx, task, targetColumnId, dto.index),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!isSerializationConflict || attempt === MAX_RETRIES) {
          throw error;
        }
        // Someone else moved a task in the same column at the same instant -
        // retry with a fresh read of sibling positions.
      }
    }

    // Unreachable: the loop above always returns or throws.
    throw new Error('Task move failed after retries');
  }

  private async reorderWithinTransaction(
    tx: Prisma.TransactionClient,
    task: { id: string; columnId: string; column: { boardId: string } },
    targetColumnId: string,
    rawIndex: number,
  ) {
    const targetColumn = await tx.column.findUnique({ where: { id: targetColumnId } });
    if (!targetColumn) {
      throw new NotFoundException('Target column not found');
    }
    if (targetColumn.boardId !== task.column.boardId) {
      throw new BadRequestException('Cannot move a task to a column on a different board');
    }

    // Every OTHER task currently in the target column, in order. If this is
    // a same-column reorder, the moving task is excluded from its own
    // neighbour calculation.
    const siblings = await tx.task.findMany({
      where: { columnId: targetColumnId, id: { not: task.id } },
      orderBy: { position: 'asc' },
    });

    const index = Math.min(Math.max(rawIndex, 0), siblings.length);
    const before = index > 0 ? siblings[index - 1].position : null;
    const after = index < siblings.length ? siblings[index].position : null;

    let position: number;
    if (before === null && after === null) {
      position = 1024; // first task ever placed in this column
    } else if (before === null) {
      position = after! / 2; // becomes the new first task
    } else if (after === null) {
      position = before + 1; // becomes the new last task
    } else {
      position = (before + after) / 2; // slots in between two existing tasks
    }

    return tx.task.update({
      where: { id: task.id },
      data: { columnId: targetColumnId, position },
      include: { column: true },
    });
  }
}
