import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ThrottlerModule,
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import request from 'supertest';
import { CandidaturaStatus, JobStatus, Prisma, Role } from '@prisma/client';
import { envValidationSchema } from '../src/config/env.validation';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { JobPostingsModule } from '../src/modules/job-postings/job-postings.module';

describe('Candidaturas E2E (fluxos CR-TI)', () => {
  let app: INestApplication;
  let prisma: Partial<Record<keyof PrismaService, jest.Mock>>;
  let jwtService: JwtService;
  let throttlerStorage: ThrottlerStorageService;

  const professionalUser = {
    id: 'prof-1',
    email: 'prof@test.com',
    passwordHash: '',
    role: Role.PROFISSIONAL,
    active: true,
    deletedAt: null,
  };

  const openJob = {
    id: 'job-1',
    title: 'Chef',
    restaurantId: 'rest-1',
    status: JobStatus.ABERTA,
    active: true,
    deletedAt: null,
  };

  const pausedJob = {
    id: 'job-2',
    title: 'Garçom',
    restaurantId: 'rest-1',
    status: JobStatus.PAUSADA,
    active: true,
    deletedAt: null,
  };

  const inactiveJob = {
    id: 'job-3',
    title: 'Ajudante',
    restaurantId: 'rest-1',
    status: JobStatus.ABERTA,
    active: false,
    deletedAt: null,
  };

  const deletedJob = {
    ...openJob,
    deletedAt: new Date(),
  };

  const application = {
    id: 'app-1',
    jobId: 'job-1',
    professionalId: 'prof-1',
    status: CandidaturaStatus.PENDENTE,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  };

  const applicantsPage = {
    data: [
      {
        id: 'app-1',
        jobId: 'job-1',
        professionalId: 'prof-1',
        status: CandidaturaStatus.PENDENTE,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        professional: {
          userId: 'prof-1',
          fullName: 'John Doe',
          mainRole: 'Chef',
          profilePhoto: null,
          experienceSummary: null,
          averageRating: null,
        },
      },
    ],
    total: 1,
    skip: 0,
    take: 20,
  };

  beforeAll(async () => {
    prisma = {
      job: {
        findUnique: jest.fn(),
      },
      candidatura: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
        }),
        ThrottlerModule.forRoot({
          throttlers: [
            {
              name: 'login',
              limit: 100,
              ttl: 60 * 1000,
            },
          ],
        }),
        AuthModule,
        JobPostingsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);
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
    throttlerStorage.storage.clear();
  });

  const tokenFor = (id: string, role: Role) => jwtService.sign({ id, role });
  const authHeader = (id: string, role: Role) => ({
    Authorization: `Bearer ${tokenFor(id, role)}`,
  });

  describe('POST /jobs/:id/applications — candidatar-se a uma vaga', () => {
    it('should return 201 when a professional applies to an open job', async () => {
      prisma.job.findUnique.mockResolvedValue(openJob);
      prisma.candidatura.create.mockResolvedValue(application);

      const response = await request(app.getHttpServer())
        .post('/api/jobs/job-1/applications')
        .set(authHeader('prof-1', Role.PROFISSIONAL))
        .send({})
        .expect(201);

      expect(response.body.id).toBe('app-1');
      expect(response.body.jobId).toBe('job-1');
      expect(response.body.professionalId).toBe('prof-1');

      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        select: { status: true, active: true, deletedAt: true },
      });
      expect(prisma.candidatura.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { jobId: 'job-1', professionalId: 'prof-1' },
        }),
      );
    });

    it('should return 401 when no token is sent', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/job-1/applications')
        .send({})
        .expect(401);
    });

    it('should return 403 when a restaurant tries to apply (wrong role)', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/job-1/applications')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .send({})
        .expect(403);
    });

    it('should return 404 when the job does not exist', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/jobs/inexistente/applications')
        .set(authHeader('prof-1', Role.PROFISSIONAL))
        .send({})
        .expect(404);
    });

    it('should return 422 when the job is paused (not open for applications)', async () => {
      prisma.job.findUnique.mockResolvedValue(pausedJob);

      await request(app.getHttpServer())
        .post('/api/jobs/job-2/applications')
        .set(authHeader('prof-1', Role.PROFISSIONAL))
        .send({})
        .expect(422);
    });

    it('should return 422 when the job is inactive', async () => {
      prisma.job.findUnique.mockResolvedValue(inactiveJob);

      await request(app.getHttpServer())
        .post('/api/jobs/job-3/applications')
        .set(authHeader('prof-1', Role.PROFISSIONAL))
        .send({})
        .expect(422);
    });

    it('should return 404 when the job is soft-deleted', async () => {
      prisma.job.findUnique.mockResolvedValue(deletedJob);

      await request(app.getHttpServer())
        .post('/api/jobs/job-1/applications')
        .set(authHeader('prof-1', Role.PROFISSIONAL))
        .send({})
        .expect(404);
    });

    it('should return 400 when the body has unexpected fields', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/job-1/applications')
        .set(authHeader('prof-1', Role.PROFISSIONAL))
        .send({ campoInvalido: 'x' })
        .expect(400);
    });

    it('should return 401 when the token is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/job-1/applications')
        .set({ Authorization: 'Bearer token-invalido' })
        .send({})
        .expect(401);
    });

    it('should return 409 when the professional already applied to the job', async () => {
      prisma.job.findUnique.mockResolvedValue(openJob);
      const alreadyApplied = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        { code: 'P2002' },
      );
      prisma.candidatura.create.mockRejectedValue(alreadyApplied);

      await request(app.getHttpServer())
        .post('/api/jobs/job-1/applications')
        .set(authHeader('prof-1', Role.PROFISSIONAL))
        .send({})
        .expect(409);
    });
  });

  describe('GET /jobs/:id/applications — listar candidatos da vaga', () => {
    it('should return 200 with the applicants of the restaurant own job', async () => {
      prisma.job.findUnique.mockResolvedValue(openJob);
      prisma.candidatura.findMany.mockResolvedValue(applicantsPage.data);
      prisma.candidatura.count.mockResolvedValue(applicantsPage.total);

      const response = await request(app.getHttpServer())
        .get('/api/jobs/job-1/applications')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].applicationId).toBe('app-1');
      expect(response.body.data[0].professional.fullName).toBe('John Doe');

      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        select: { restaurantId: true, active: true, deletedAt: true },
      });
      expect(prisma.candidatura.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { jobId: 'job-1' } }),
      );
      expect(prisma.candidatura.count).toHaveBeenCalledWith({
        where: { jobId: 'job-1' },
      });
    });

    it('should return 401 when no token is sent', async () => {
      await request(app.getHttpServer())
        .get('/api/jobs/job-1/applications')
        .expect(401);
    });

    it('should return 403 when a professional tries to list (wrong role)', async () => {
      await request(app.getHttpServer())
        .get('/api/jobs/job-1/applications')
        .set(authHeader('prof-1', Role.PROFISSIONAL))
        .expect(403);
    });

    it('should return 403 when a restaurant lists applicants of another restaurant job', async () => {
      prisma.job.findUnique.mockResolvedValue({
        ...openJob,
        restaurantId: 'rest-2',
      });

      await request(app.getHttpServer())
        .get('/api/jobs/job-1/applications')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .expect(403);
    });

    it('should return 404 when the job does not exist', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/jobs/inexistente/applications')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .expect(404);
    });

    it('should return 404 when the job is inactive', async () => {
      prisma.job.findUnique.mockResolvedValue(inactiveJob);

      await request(app.getHttpServer())
        .get('/api/jobs/job-3/applications')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .expect(404);
    });
  });

  describe('PATCH /jobs/:jobId/applications/:applicationId/status — atualizar status da candidatura', () => {
    const approved = { ...application, status: CandidaturaStatus.APROVADA };
    const rejected = { ...application, status: CandidaturaStatus.REJEITADA };

    it('should return 200 and approve the application', async () => {
      prisma.candidatura.findUnique.mockResolvedValue({
        ...application,
        job: { ...openJob, restaurantId: 'rest-1' },
      });
      prisma.candidatura.update.mockResolvedValue(approved);

      const response = await request(app.getHttpServer())
        .patch('/api/jobs/job-1/applications/app-1/status')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .send({ status: CandidaturaStatus.APROVADA })
        .expect(200);

      expect(response.body.status).toBe(CandidaturaStatus.APROVADA);
      expect(prisma.candidatura.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { status: CandidaturaStatus.APROVADA },
      });
    });

    it('should return 200 and reject the application', async () => {
      prisma.candidatura.findUnique.mockResolvedValue({
        ...application,
        job: { ...openJob, restaurantId: 'rest-1' },
      });
      prisma.candidatura.update.mockResolvedValue(rejected);

      await request(app.getHttpServer())
        .patch('/api/jobs/job-1/applications/app-1/status')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .send({ status: CandidaturaStatus.REJEITADA })
        .expect(200);
    });

    it('should return 400 when the status is invalid', async () => {
      await request(app.getHttpServer())
        .patch('/api/jobs/job-1/applications/app-1/status')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .send({ status: 'INVALIDO' })
        .expect(400);
    });

    it('should return 401 when the token is invalid', async () => {
      await request(app.getHttpServer())
        .patch('/api/jobs/job-1/applications/app-1/status')
        .set({ Authorization: 'Bearer token-invalido' })
        .send({ status: CandidaturaStatus.APROVADA })
        .expect(401);
    });

    it('should return 404 when the application belongs to another job', async () => {
      prisma.candidatura.findUnique.mockResolvedValue({
        ...application,
        jobId: 'job-999',
        job: { ...openJob, restaurantId: 'rest-1', id: 'job-999' },
      });

      await request(app.getHttpServer())
        .patch('/api/jobs/job-1/applications/app-1/status')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .send({ status: CandidaturaStatus.APROVADA })
        .expect(404);
    });

    it('should return 401 when no token is sent', async () => {
      await request(app.getHttpServer())
        .patch('/api/jobs/job-1/applications/app-1/status')
        .send({ status: CandidaturaStatus.APROVADA })
        .expect(401);
    });

    it('should return 403 when a professional tries to update (wrong role)', async () => {
      await request(app.getHttpServer())
        .patch('/api/jobs/job-1/applications/app-1/status')
        .set(authHeader('prof-1', Role.PROFISSIONAL))
        .send({ status: CandidaturaStatus.APROVADA })
        .expect(403);
    });

    it('should return 403 when a restaurant updates another restaurant application', async () => {
      prisma.candidatura.findUnique.mockResolvedValue({
        ...application,
        job: { ...openJob, restaurantId: 'rest-2' },
      });

      await request(app.getHttpServer())
        .patch('/api/jobs/job-1/applications/app-1/status')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .send({ status: CandidaturaStatus.APROVADA })
        .expect(403);
    });

    it('should return 404 when the application does not exist or belongs to another job', async () => {
      prisma.candidatura.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/api/jobs/job-1/applications/inexistente/status')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .send({ status: CandidaturaStatus.APROVADA })
        .expect(404);
    });

    it('should return 422 when reverting a terminal status to PENDENTE', async () => {
      const terminal = { ...application, status: CandidaturaStatus.APROVADA };
      prisma.candidatura.findUnique.mockResolvedValue({
        ...terminal,
        job: { ...openJob, restaurantId: 'rest-1' },
      });

      await request(app.getHttpServer())
        .patch('/api/jobs/job-1/applications/app-1/status')
        .set(authHeader('rest-1', Role.RESTAURANTE))
        .send({ status: CandidaturaStatus.PENDENTE })
        .expect(422);
    });
  });
});
