import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppController (e2e) — GET /api (health check)', () => {
  let app: INestApplication<App>;
  // O banco é simulado: o e2e não depende de um Postgres de teste no ar.
  const prisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (app) {
      await app.close();
    }
  });

  it('200 com status ok, sem token, quando o banco responde', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(app.getHttpServer()).get('/api').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'komanda-api',
      database: 'up',
      docs: '/api/docs',
    });
  });

  it('503 com database down quando o banco não responde', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const response = await request(app.getHttpServer()).get('/api').expect(503);

    expect(response.body).toMatchObject({ status: 'error', database: 'down' });
  });
});
