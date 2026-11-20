import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { Prisma, Role } from '@prisma/client';
import { envValidationSchema } from '../src/config/env.validation';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { JobsModule } from '../src/modules/jobs/Jobs.module';

describe('GET /jobs/:id E2E (detalhe da vaga)', () => {
  let app: INestApplication;
  let prisma: {
    job: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  };
  let jwtService: JwtService;

  const JOB_ID = '3b6f7c2a-1d4e-4a5b-8c9d-0e1f2a3b4c5d';

  const jobRow = {
    id: JOB_ID,
    title: 'Garçom',
    description: 'Atendimento no salão em eventos e jantares',
    requirements: null,
    salary: new Prisma.Decimal('2200.50'),
    contractType: 'CLT',
    shifts: ['NOITE'],
    status: 'ABERTA',
    urgent: false,
    restaurantId: 'restaurant-1',
    createdAt: new Date('2026-11-18T10:00:00Z'),
    restaurant: {
      restaurantName: 'Cantina Bella Massa',
      logoUrl: null,
      cuisineType: 'Italiana',
      averageRating: null,
      address: 'Rua das Flores, 100',
      zipCode: null,
    },
    candidaturas: [],
  };

  beforeAll(async () => {
    prisma = {
      job: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
        }),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', limit: 100, ttl: 60 * 1000 }],
        }),
        AuthModule,
        JobsModule,
      ],
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  const authHeader = (id: string, role: Role) => ({
    Authorization: `Bearer ${jwtService.sign({ id, role })}`,
  });

  it('retorna 200 com a vaga no formato da lista + candidatura', async () => {
    prisma.job.findFirst.mockResolvedValue(jobRow);

    const response = await request(app.getHttpServer())
      .get(`/api/jobs/${JOB_ID}`)
      .set(authHeader('prof-1', Role.PROFISSIONAL))
      .expect(200);

    expect(response.body).toEqual({
      id: JOB_ID,
      title: 'Garçom',
      description: 'Atendimento no salão em eventos e jantares',
      requirements: null,
      salary: '2200.5',
      contractType: 'CLT',
      shifts: ['NOITE'],
      status: 'ABERTA',
      urgent: false,
      restaurantId: 'restaurant-1',
      restaurant: {
        restaurantName: 'Cantina Bella Massa',
        logoUrl: null,
        cuisineType: 'Italiana',
        averageRating: null,
        address: 'Rua das Flores, 100',
        zipCode: null,
      },
      createdAt: '2026-11-18T10:00:00.000Z',
      hasApplied: false,
      application: null,
    });
  });

  it('retorna 400 quando o id não é UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/jobs/abc')
      .set(authHeader('prof-1', Role.PROFISSIONAL))
      .expect(400);

    expect(prisma.job.findFirst).not.toHaveBeenCalled();
  });

  it('retorna 401 sem token', async () => {
    await request(app.getHttpServer()).get(`/api/jobs/${JOB_ID}`).expect(401);
  });

  it('retorna 404 quando a vaga não existe', async () => {
    prisma.job.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(`/api/jobs/${JOB_ID}`)
      .set(authHeader('prof-1', Role.PROFISSIONAL))
      .expect(404);

    expect(response.body).toMatchObject({ message: 'Vaga não encontrada' });
  });

  it('GET /jobs/search continua sendo a busca (não é lido como :id)', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);

    await request(app.getHttpServer())
      .get('/api/jobs/search')
      .set(authHeader('prof-1', Role.PROFISSIONAL))
      .expect(200);

    expect(prisma.job.findFirst).not.toHaveBeenCalled();
    expect(prisma.job.findMany).toHaveBeenCalled();
  });
});
