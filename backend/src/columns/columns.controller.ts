import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { ColumnsService } from './columns.service.js';
import { ColumnMoveService } from './column-move.service.js';
import { CreateColumnDto } from './dto/create-column.dto.js';
import { UpdateColumnDto } from './dto/update-column.dto.js';
import { MoveColumnDto } from './dto/move-column.dto.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class ColumnsController {
  constructor(
    private readonly columnsService: ColumnsService,
    private readonly columnMoveService: ColumnMoveService,
  ) {}

  @Post('boards/:boardId/columns')
  create(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
    @Body() dto: CreateColumnDto,
  ) {
    return this.columnsService.create(user.id, boardId, dto);
  }

  @Patch('columns/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateColumnDto) {
    return this.columnsService.update(user.id, id, dto);
  }

  @Delete('columns/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.columnsService.remove(user.id, id);
  }

  /** Reorders a column within its board. See ColumnMoveService. */
  @Post('columns/:id/move')
  @HttpCode(HttpStatus.OK)
  move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveColumnDto) {
    return this.columnMoveService.move(user.id, id, dto);
  }
}
