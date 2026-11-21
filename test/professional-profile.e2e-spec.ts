import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { Role } from '@prisma/client';
import { envValidationSchema } from '../src/config/env.validation';
import { PrismaService } from '../src/prisma/prisma.service';
import { activeAccountsLookup } from './support/active-accounts';
import { AuthModule } from '../src/auth/auth.module';
import { ProfessionalsModule } from '../src/modules/professionals/Professionals.module';

describe('GET /professionals/:id E2E (perfil público do profissional)', () => {
  let app: INestApplication;
  let prisma: { professional: { findFirst: jest.Mock } };
  let jwtService: JwtService;

  const PROFESSIONAL_ID = '3a7d9c1e-2b4f-4e6a-8c0d-5f1e2d3c4b5a';

  const professionalRow = {
    userId: PROFESSIONAL_ID,
    fullName: 'Marina Souza',
    profilePhoto: null,
    mainRole: 'Garçonete',
    interestedRoles: ['Bartender'],
    specialties: ['Atendimento'],
    experienceSummary: '5 anos em restaurantes',
    city: 'Porto Seguro',
    state: 'BA',
    neighborhood: 'Centro',
    workModels: ['CLT'],
    mobility: 'LOCAL',
    averageRating: 4.6,
    createdAt: new Date('2026-01-10T12:00:00Z'),
    experiences: [
      {
        id: 'exp-1',
        company: 'Maré Alta',
        role: 'Garçonete',
        startDate: new Date('2024-03-01T00:00:00Z'),
        endDate: null,
        description: null,
      },
    ],
    _count: { avaliacoes: 12 },
  };

  beforeAll(async () => {
    prisma = { professional: { findFirst: jest.fn() } };

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
        ProfessionalsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);
    // O AuthGuard confere a conta no banco (ver test/support/active-accounts).
    Object.assign(prisma, {
      user: { findUnique: activeAccountsLookup(jwtService).findUnique },
    });
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

  it.each([Role.RESTAURANTE, Role.PROFISSIONAL])(
    'retorna 200 com o perfil para token de %s, sem e-mail nem CEP',
    async (role) => {
      prisma.professional.findFirst.mockResolvedValue(professionalRow);

      const response = await request(app.getHttpServer())
        .get(`/api/professionals/${PROFESSIONAL_ID}`)
        .set(authHeader('qualquer-usuario', role))
        .expect(200);

      expect(response.body).toEqual({
        id: PROFESSIONAL_ID,
        fullName: 'Marina Souza',
        profilePhoto: null,
        mainRole: 'Garçonete',
        interestedRoles: ['Bartender'],
        specialties: ['Atendimento'],
        experienceSummary: '5 anos em restaurantes',
        city: 'Porto Seguro',
        state: 'BA',
        neighborhood: 'Centro',
        workModels: ['CLT'],
        mobility: 'LOCAL',
        averageRating: 4.6,
        reviewsCount: 12,
        memberSince: '2026-01-10T12:00:00.000Z',
        experiences: [
          {
            id: 'exp-1',
            company: 'Maré Alta',
            role: 'Garçonete',
            startDate: '2024-03-01T00:00:00.000Z',
            endDate: null,
            description: null,
          },
        ],
      });
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('zipCode');
    },
  );

  it('retorna 400 quando o id não é UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/professionals/abc')
      .set(authHeader('rest-1', Role.RESTAURANTE))
      .expect(400);

    expect(prisma.professional.findFirst).not.toHaveBeenCalled();
  });

  it('não captura /professionals/search (continua restrita a restaurante)', async () => {
    await request(app.getHttpServer())
      .get('/api/professionals/search')
      .set(authHeader('prof-1', Role.PROFISSIONAL))
      .expect(403);

    expect(prisma.professional.findFirst).not.toHaveBeenCalled();
  });

  it('retorna 401 sem token', async () => {
    await request(app.getHttpServer())
      .get(`/api/professionals/${PROFESSIONAL_ID}`)
      .expect(401);

    expect(prisma.professional.findFirst).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o profissional foi excluído ou não existe', async () => {
    prisma.professional.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(`/api/professionals/${PROFESSIONAL_ID}`)
      .set(authHeader('rest-1', Role.RESTAURANTE))
      .expect(404);

    expect(response.body).toMatchObject({
      message: 'Profissional não encontrado',
    });
  });
});
