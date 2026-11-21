import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService, type HealthResponse } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Health check fica fora do throttle: 429 aqui derrubaria o probe.
  @SkipThrottle()
  @Get()
  @ApiOperation({
    summary: 'Status da API e do banco de dados',
    description: 'Público, sem token. 503 quando o banco não responde.',
  })
  @ApiResponse({
    status: 200,
    description: 'API e banco no ar',
    schema: {
      example: {
        status: 'ok',
        service: 'komanda-api',
        database: 'up',
        uptimeSeconds: 120,
        timestamp: '2026-11-20T12:00:00.000Z',
        docs: '/api/docs',
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Banco de dados fora do ar' })
  health(): Promise<HealthResponse> {
    return this.appService.health();
  }
}
