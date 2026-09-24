import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { HealthCheckService, PrismaHealthIndicator, HealthCheck } from '@nestjs/terminus';
import { prisma } from '@textile-erp/database';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
  ) {}

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }

  @Get('health/readiness')
  @HealthCheck()
  getReadiness() {
    return this.health.check([
      () => this.db.pingCheck('database', prisma),
    ]);
  }
}
