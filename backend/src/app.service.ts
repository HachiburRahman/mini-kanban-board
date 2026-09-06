import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

export interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  database: 'up' | 'down';
  uptime: number;
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Root route. Returns a health payload rather than the `nest new` greeting -
   * it is the first thing anything hitting the API sees, and a container
   * orchestrator can use it as a readiness probe.
   */
  async getHealth(): Promise<HealthReport> {
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'mini-kanban-board-api',
      database,
      uptime: Math.round(process.uptime()),
    };
  }
}
