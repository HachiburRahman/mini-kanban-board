import { Module } from '@nestjs/common';
import { ColumnsController } from './columns.controller.js';
import { ColumnsService } from './columns.service.js';
import { BoardAccessModule } from '../boards/board-access.module.js';

@Module({
  imports: [BoardAccessModule],
  controllers: [ColumnsController],
  providers: [ColumnsService],
})
export class ColumnsModule {}
