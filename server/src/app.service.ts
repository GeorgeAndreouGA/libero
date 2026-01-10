import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  async getReadiness() {
    // TODO: Add checks for database, external services
    return {
      status: 'ready',
      checks: {
        database: 'pending',
      },
    };
  }
}
