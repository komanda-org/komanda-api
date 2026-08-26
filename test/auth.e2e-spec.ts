import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { envValidationSchema } from '../src/config/env.validation';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth E2E', () => {
  let app: INestApplication;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
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
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(JwtService)
      .useValue(mockJwtService)
      .compile();

    app = moduleFixture.createNestApplication();
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
  });

  describe('POST /auth/login', () => {
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
        .post('/auth/login')
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
        .post('/auth/login')
        .send(loginDto)
        .expect(400);
    });

    it('should return 404 when user not found', async () => {
      const loginDto = {
        email: 'notfound@example.com',
        password: 'password',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(404);
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
        .post('/auth/login')
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
        .post('/auth/login')
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
        .post('/auth/login')
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
        passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        active: true,
        role: 'PROFISSIONAL',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(429)
        .expect(({ body }) => {
          expect(body.message).toMatch(/muitas tentativas|Too Many Requests/i);
        });
    });
  });
});
