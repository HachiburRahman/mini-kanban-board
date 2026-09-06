import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { BoardAccessService } from '../boards/board-access.service.js';
import { MoveColumnDto } from './dto/move-column.dto.js';
import { orderWithMovingItem, placeBetween, renumberedPosition } from '../common/ordering.js';

const MAX_RETRIES = 3;

/**
 * Reordering columns within a board. Same fractional-index scheme and same
 * serializable-transaction-with-retry as TaskMoveService, minus the
 * cross-container case: a column never leaves its board.
 */
@Injectable()
export class ColumnMoveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
  ) {}

  async move(userId: string, columnId: string, dto: MoveColumnDto) {
    const column = await this.prisma.column.findUnique({ where: { id: columnId } });
    if (!column) {
      throw new NotFoundException('Column not found');
    }

    await this.access.assertAccess(userId, column.boardId);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.reorderWithinTransaction(tx, column, dto.index),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!isSerializationConflict || attempt === MAX_RETRIES) {
          throw error;
        }
        // Another member reordered the same board at the same instant -
        // retry with a fresh read of sibling positions.
      }
    }

    // Unreachable: the loop above always returns or throws.
    throw new Error('Column move failed after retries');
  }

  private async reorderWithinTransaction(
    tx: Prisma.TransactionClient,
    column: { id: string; boardId: string },
    rawIndex: number,
  ) {
    const siblings = await tx.column.findMany({
      where: { boardId: column.boardId, id: { not: column.id } },
      orderBy: { position: 'asc' },
    });

    const { index, position, needsRenumber } = placeBetween(siblings, rawIndex);

    if (needsRenumber) {
      return this.renumberBoard(tx, column.id, siblings, index);
    }

    return tx.column.update({ where: { id: column.id }, data: { position } });
  }

  private async renumberBoard(
    tx: Prisma.TransactionClient,
    columnId: string,
    siblings: { id: string }[],
    index: number,
  ) {
    const ordered = orderWithMovingItem(siblings, columnId, index);

    for (const [i, id] of ordered.entries()) {
      if (id === columnId) continue; // the moving row is updated last, below
      await tx.column.update({ where: { id }, data: { position: renumberedPosition(i) } });
    }

    return tx.column.update({
      where: { id: columnId },
      data: { position: renumberedPosition(ordered.indexOf(columnId)) },
    });
  }
}
