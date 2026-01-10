import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Root endpoint' })
  getRoot() {
    return {
      message: 'Libero Tips API',
      version: '1.0.0',
      docs: '/api/docs',
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check endpoint' })
  getReadiness() {
    return this.appService.getReadiness();
  }
}
