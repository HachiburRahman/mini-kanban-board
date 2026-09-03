import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { BoardAccessService } from '../boards/board-access.service.js';
import { MoveTaskDto } from './dto/move-task.dto.js';

const MAX_RETRIES = 3;

/** Spacing used when a column is renumbered, and for the first task in one. */
const POSITION_SPACING = 1024;

/**
 * Smallest gap we will split before renumbering the column instead.
 *
 * Fractional indexing halves the gap on every drop into the same slot, so
 * `position` shrinks geometrically: dropping repeatedly at the top of a column
 * took it from 1024 to ~7e-18 in 120 moves. Left alone it reaches 0 after
 * roughly 1080 moves, and from then on `after / 2` is also 0 - cards tie and
 * ordering silently stops working, with no error anywhere. Renumbering well
 * before that keeps the gaps healthy.
 */
const MIN_GAP = 1e-4;

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
      position = POSITION_SPACING; // first task ever placed in this column
    } else if (before === null) {
      position = after! / 2; // becomes the new first task
    } else if (after === null) {
      position = before + 1; // becomes the new last task
    } else {
      position = (before + after) / 2; // slots in between two existing tasks
    }

    // The gap we just split (or the headroom below the first card) has become
    // too small to keep halving. Renumber the whole column onto fresh, evenly
    // spaced positions instead - same visible order, healthy gaps again.
    const gap = before !== null && after !== null ? after - before : (after ?? Infinity);
    if (gap < MIN_GAP || !Number.isFinite(position) || position <= 0) {
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
    const ordered = [...siblings.map((s) => s.id)];
    ordered.splice(index, 0, taskId);

    for (const [i, id] of ordered.entries()) {
      const position = (i + 1) * POSITION_SPACING;
      if (id === taskId) continue; // the moving row is updated last, below
      await tx.task.update({ where: { id }, data: { position } });
    }

    return tx.task.update({
      where: { id: taskId },
      data: {
        columnId: targetColumnId,
        position: (ordered.indexOf(taskId) + 1) * POSITION_SPACING,
      },
      include: { column: true },
    });
  }
}
