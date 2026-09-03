import { Module } from '@nestjs/common';
import { BoardAccessService } from './board-access.service.js';

@Module({
  providers: [BoardAccessService],
  exports: [BoardAccessService],
})
export class BoardAccessModule {}
