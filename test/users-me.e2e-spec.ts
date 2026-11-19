import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { Role } from '@prisma/client';
import { envValidationSchema } from '../src/config/env.validation';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { EXPERIENCES_INCLUDE } from '../src/modules/users/professional-profile.mapper';
import { UsersModule } from '../src/modules/users/users.module';

describe('GET /users/me E2E (perfil do usuário logado)', () => {
  let app: INestApplication;
  let prisma: {
    professional: { findFirst: jest.Mock };
    restaurant: { findFirst: jest.Mock };
  };
  let jwtService: JwtService;

  const professional = {
    userId: 'prof-1',
    fullName: 'Julian Rossi',
    mainRole: 'Chef Executivo',
    profilePhoto: null,
    experienceSummary: null,
    neighborhood: 'Pinheiros',
    zipCode: '05422-000',
    interestedRoles: [],
    averageRating: 4.5,
    specialties: [],
    city: null,
    state: null,
    workModels: [],
    mobility: null,
    experiences: [],
  };

  beforeAll(async () => {
    prisma = {
      professional: { findFirst: jest.fn() },
      restaurant: { findFirst: jest.fn() },
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
        UsersModule,
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

  it('retorna 200 com o perfil no formato esperado pelo front', async () => {
    prisma.professional.findFirst.mockResolvedValue(professional);

    const response = await request(app.getHttpServer())
      .get('/api/users/me')
      .set(authHeader('prof-1', Role.PROFISSIONAL))
      .expect(200);

    expect(response.body).toEqual({
      role: 'PROFISSIONAL',
      id: 'prof-1',
      fullName: 'Julian Rossi',
      mainRole: 'Chef Executivo',
      profilePhoto: null,
      experienceSummary: null,
      specialties: [],
      neighborhood: 'Pinheiros',
      zipCode: '05422-000',
      city: null,
      state: null,
      experiences: [],
      availability: null,
    });
    expect(prisma.professional.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'prof-1',
        deletedAt: null,
        user: { deletedAt: null },
      },
      include: EXPERIENCES_INCLUDE,
    });
  });

  it('retorna 401 sem o header Authorization', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);

    expect(prisma.professional.findFirst).not.toHaveBeenCalled();
  });

  it('retorna 401 com token inválido', async () => {
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('retorna 200 com o perfil do restaurante para token de RESTAURANTE', async () => {
    prisma.restaurant.findFirst.mockResolvedValue({
      userId: 'rest-1',
      restaurantName: 'Cantina Bella Massa',
      cnpj: '12.345.678/0001-95',
      cuisineType: 'Italiana',
      description: 'Massas artesanais e ambiente familiar',
      address: 'Rua das Flores, 100',
      phone: '(73) 99999-0000',
      zipCode: '45820-020',
      logoUrl: null,
      averageRating: 4.2,
      plan: 'FREE',
      active: true,
      deletedAt: null,
      user: { email: 'cantina@komanda.dev' },
    });

    const response = await request(app.getHttpServer())
      .get('/api/users/me')
      .set(authHeader('rest-1', Role.RESTAURANTE))
      .expect(200);

    expect(response.body).toEqual({
      role: 'RESTAURANTE',
      id: 'rest-1',
      email: 'cantina@komanda.dev',
      restaurantName: 'Cantina Bella Massa',
      cnpj: '12.345.678/0001-95',
      cuisineType: 'Italiana',
      description: 'Massas artesanais e ambiente familiar',
      address: 'Rua das Flores, 100',
      phone: '(73) 99999-0000',
      zipCode: '45820-020',
      logoUrl: null,
      averageRating: 4.2,
      plan: 'FREE',
    });
    expect(prisma.professional.findFirst).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o restaurante do token foi excluído', async () => {
    prisma.restaurant.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set(authHeader('rest-excluido', Role.RESTAURANTE))
      .expect(404);
  });
  it('retorna 404 quando o profissional do token não existe', async () => {
    prisma.professional.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set(authHeader('prof-fantasma', Role.PROFISSIONAL))
      .expect(404);
  });
});
