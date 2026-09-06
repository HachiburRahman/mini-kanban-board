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
import { TasksService } from './tasks.service.js';
import { TaskMoveService } from './task-move.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { MoveTaskDto } from './dto/move-task.dto.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskMoveService: TaskMoveService,
  ) {}

  @Post('columns/:columnId/tasks')
  create(
    @CurrentUser() user: AuthUser,
    @Param('columnId') columnId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(user.id, columnId, dto);
  }

  @Patch('tasks/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(user.id, id, dto);
  }

  @Delete('tasks/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.remove(user.id, id);
  }

  /**
   * The task movement endpoint: reorders within the current column when
   * `columnId` is omitted, or moves to a specific index in another column
   * when it's given. See TaskMoveService for the ordering/concurrency logic.
   */
  @Post('tasks/:id/move')
  @HttpCode(HttpStatus.OK)
  move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveTaskDto) {
    return this.taskMoveService.move(user.id, id, dto);
  }
}
