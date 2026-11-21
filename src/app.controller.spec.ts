import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController (health check)', () => {
  let appController: AppController;
  const prisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('responde status ok quando o banco está no ar', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await appController.health();

    expect(result).toMatchObject({
      status: 'ok',
      service: 'komanda-api',
      database: 'up',
      docs: '/api/docs',
    });
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('responde 503 com database down quando o banco não responde', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const error = (await appController
      .health()
      .catch((e: unknown) => e)) as ServiceUnavailableException;

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getResponse()).toMatchObject({
      status: 'error',
      database: 'down',
    });
  });
});
