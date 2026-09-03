import { Module } from '@nestjs/common';
import { BoardsController } from './boards.controller.js';
import { BoardsService } from './boards.service.js';
import { BoardAccessModule } from './board-access.module.js';

@Module({
  imports: [BoardAccessModule],
  controllers: [BoardsController],
  providers: [BoardsService],
  exports: [BoardAccessModule],
})
export class BoardsModule {}
