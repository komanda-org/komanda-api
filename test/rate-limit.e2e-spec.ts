import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { envValidationSchema } from '../src/config/env.validation';
import { JobsModule } from '../src/modules/jobs/Jobs.module';
import { NotificationsModule } from '../src/modules/notifications/notifications.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Limite global baixo de propósito: as leituras de tela não podem receber 429
// (o front recarrega e faz polling), mas o resto continua limitado.
const GLOBAL_LIMIT = 2;
const REQUESTS = GLOBAL_LIMIT * 3;

describe('Rate limit global x leituras de tela (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const prisma = {
    job: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    notificacao: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
  };

  beforeAll(async () => {
    process.env.AUTH_LOGIN_LIMIT = String(GLOBAL_LIMIT);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
        }),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', limit: GLOBAL_LIMIT, ttl: 60_000 }],
        }),
        AuthModule,
        JobsModule,
        NotificationsModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];
  const bearer = (role: Role) =>
    `Bearer ${jwtService.sign({ id: 'user-1', role })}`;

  it.each([
    ['/api/jobs', Role.PROFISSIONAL],
    ['/api/jobs/search', Role.PROFISSIONAL],
    ['/api/users/me/notifications', Role.RESTAURANTE],
  ])('GET %s não recebe 429 acima do limite global', async (path, role) => {
    for (let i = 0; i < REQUESTS; i++) {
      await request(server())
        .get(path)
        .set('Authorization', bearer(role))
        .expect(200);
    }
  });

  it('login continua limitado (429 ao passar do limite)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < REQUESTS; i++) {
      const res = await request(server())
        .post('/api/auth/login')
        .send({ email: 'x@komanda.dev', password: 'Senha@12345' });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
  });
});
