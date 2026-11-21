import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { envValidationSchema } from '../src/config/env.validation';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth E2E', () => {
  let app: INestApplication;
  let throttlerStorage: ThrottlerStorageService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-token-123'),
    verify: jest.fn(),
  };

  beforeAll(async () => {
    process.env.AUTH_LOGIN_LIMIT = '2';
    process.env.AUTH_LOGIN_TTL_SECONDS = '60';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
        }),
        ThrottlerModule.forRoot({
          throttlers: [
            {
              name: 'default',
              limit: Number(process.env.AUTH_LOGIN_LIMIT ?? 5),
              ttl: Number(process.env.AUTH_LOGIN_TTL_SECONDS ?? 60) * 1000,
            },
          ],
        }),
        AuthModule,
      ],
      // Mesmo guard global registrado no AppModule, para o teste refletir a app.
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(JwtService)
      .useValue(mockJwtService)
      .compile();

    app = moduleFixture.createNestApplication();
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
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

  afterEach(() => {
    jest.clearAllMocks();
    // Cada teste começa com o rate limiter zerado, exceto o que exercita o
    // 429 deliberadamente dentro do próprio it().
    throttlerStorage.storage.clear();
  });

  describe('POST /api/auth/login', () => {
    it('should return 200 with token on successful login', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password',
      };

      const user = {
        id: '123',
        email: loginDto.email,
        passwordHash: await bcrypt.hash(loginDto.password, 10),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        active: true,
        role: 'PROFISSIONAL',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.id).toBe(user.id);
      expect(response.body.user.role).toBe(user.role);
    });

    it('should return 400 with invalid email format', async () => {
      const loginDto = {
        email: 'invalid-email',
        password: 'password',
      };

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginDto)
        .expect(400);
    });

    it('should return the same 401 for unknown email and wrong password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      const unknownEmail = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'notfound@example.com', password: 'password' })
        .expect(401);

      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: '123',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('right-password', 4),
        deletedAt: null,
        active: true,
        role: 'PROFISSIONAL',
      });
      const wrongPassword = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong-password' })
        .expect(401);

      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(unknownEmail.body.message).toBe('E-mail ou senha inválidos');
    });

    it('should return 401 with incorrect password', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const user = {
        id: '123',
        email: loginDto.email,
        passwordHash:
          '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        active: true,
        role: 'PROFISSIONAL',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginDto)
        .expect(401);
    });

    it('should return 401 when user account is deleted', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password',
      };

      const user = {
        id: '123',
        email: loginDto.email,
        passwordHash:
          '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
        active: true,
        role: 'PROFISSIONAL',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginDto)
        .expect(401);
    });

    it('should return 401 when user account is inactive', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password',
      };

      const user = {
        id: '123',
        email: loginDto.email,
        passwordHash:
          '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        active: false,
        role: 'PROFISSIONAL',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginDto)
        .expect(401);
    });

    it('should return 429 after exceeding the login attempt limit for the same IP', async () => {
      const loginDto = {
        email: 'rate-limit@example.com',
        password: 'wrongpassword',
      };

      const user = {
        id: '999',
        email: loginDto.email,
        passwordHash:
          '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        active: true,
        role: 'PROFISSIONAL',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginDto)
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginDto)
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginDto)
        .expect(429)
        .expect(({ body }) => {
          expect(body.message).toMatch(/muitas tentativas|Too Many Requests/i);
        });
    });
  });

  describe('POST /api/auth/recover-password', () => {
    it('should return 429 after exceeding the recovery request limit for the same IP', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      for (let attempt = 0; attempt < 3; attempt++) {
        await request(app.getHttpServer())
          .post('/api/auth/recover-password')
          .send({ email: 'missing@example.com' })
          .expect(200);
      }

      await request(app.getHttpServer())
        .post('/api/auth/recover-password')
        .send({ email: 'missing@example.com' })
        .expect(429)
        .expect(({ body }) => {
          expect(body.message).toMatch(/muitas tentativas|Too Many Requests/i);
        });
    });
  });
});
