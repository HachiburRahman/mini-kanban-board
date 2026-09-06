import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { TaskMoveService } from './task-move.service.js';
import { BoardAccessModule } from '../boards/board-access.module.js';
import { AuthModule } from '../auth/auth.module.js';

// See BoardsModule: AuthModule supplies the Passport context JwtAuthGuard needs.
@Module({
  imports: [AuthModule, BoardAccessModule],
  controllers: [TasksController],
  providers: [TasksService, TaskMoveService],
  exports: [TasksService],
})
export class TasksModule {}
