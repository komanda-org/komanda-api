import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export interface HealthResponse {
  status: 'ok' | 'error';
  service: string;
  database: 'up' | 'down';
  uptimeSeconds: number;
  timestamp: string;
  docs: string;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  // GET /api: diz se a API está de pé e se alcança o banco. 503 quando o
  // banco não responde, para monitor e quem for testar saberem na hora.
  async health(): Promise<HealthResponse> {
    const base = {
      service: 'komanda-api',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      docs: '/api/docs',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        'Health check: banco de dados não respondeu',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException({
        ...base,
        status: 'error',
        database: 'down',
      } satisfies HealthResponse);
    }

    return { ...base, status: 'ok', database: 'up' };
  }
}
