import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { BoardAccessService } from '../boards/board-access.service.js';
import { MoveTaskDto } from './dto/move-task.dto.js';
import { orderWithMovingItem, placeBetween, renumberedPosition } from '../common/ordering.js';

const MAX_RETRIES = 3;

/**
 * Handles the one endpoint that has to get concurrency right: moving a task
 * within a column (reorder) or into a different column at a specific index.
 *
 * Ordering strategy: `position` is a float (fractional indexing) - see
 * `common/ordering.ts` for the arithmetic, which columns reuse.
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

    const { index, position, needsRenumber } = placeBetween(siblings, rawIndex);

    if (needsRenumber) {
      return this.renumberColumn(tx, task.id, targetColumnId, siblings, index);
    }

    return tx.task.update({
      where: { id: task.id },
      data: { columnId: targetColumnId, position },
      include: { column: true },
    });
  }

  /**
   * Rewrites every position in the column to `POSITION_SPACING` multiples, with
   * the moving task slotted in at `index`. Runs inside the same serializable
   * transaction as the move, so a concurrent drag either sees the renumbered
   * column or loses the write and retries - never a half-renumbered one.
   */
  private async renumberColumn(
    tx: Prisma.TransactionClient,
    taskId: string,
    targetColumnId: string,
    siblings: { id: string }[],
    index: number,
  ) {
    const ordered = orderWithMovingItem(siblings, taskId, index);

    for (const [i, id] of ordered.entries()) {
      if (id === taskId) continue; // the moving row is updated last, below
      await tx.task.update({ where: { id }, data: { position: renumberedPosition(i) } });
    }

    return tx.task.update({
      where: { id: taskId },
      data: {
        columnId: targetColumnId,
        position: renumberedPosition(ordered.indexOf(taskId)),
      },
      include: { column: true },
    });
  }
}
