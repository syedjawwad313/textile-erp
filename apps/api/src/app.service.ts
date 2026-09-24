import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'UP', timestamp: new Date().toISOString() };
  }

  getReadiness() {
    // Basic readiness, later we'll inject Prisma client and test DB connection
    return { status: 'READY', database: 'PENDING' };
  }
}
