import { Module } from '@nestjs/common';
import { BoardsController } from './boards.controller.js';
import { BoardsService } from './boards.service.js';
import { BoardAccessModule } from './board-access.module.js';
import { AuthModule } from '../auth/auth.module.js';

// AuthModule is imported for its PassportModule re-export: JwtAuthGuard
// extends AuthGuard('jwt'), which needs AuthModuleOptions from Passport
// resolvable in whichever module declares @UseGuards(JwtAuthGuard).
@Module({
  imports: [AuthModule, BoardAccessModule],
  controllers: [BoardsController],
  providers: [BoardsService],
  exports: [BoardAccessModule],
})
export class BoardsModule {}
