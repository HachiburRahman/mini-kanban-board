import { Module } from '@nestjs/common';
import { ColumnsController } from './columns.controller.js';
import { ColumnsService } from './columns.service.js';
import { BoardAccessModule } from '../boards/board-access.module.js';
import { AuthModule } from '../auth/auth.module.js';

// See BoardsModule: AuthModule supplies the Passport context JwtAuthGuard needs.
@Module({
  imports: [AuthModule, BoardAccessModule],
  controllers: [ColumnsController],
  providers: [ColumnsService],
})
export class ColumnsModule {}
