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
import { RestaurantsModule } from '../src/modules/restaurants/Restaurants.module';

describe('GET /restaurants/:id E2E (perfil público do restaurante)', () => {
  let app: INestApplication;
  let prisma: { restaurant: { findFirst: jest.Mock } };
  let jwtService: JwtService;

  const RESTAURANT_ID = '6f1c2a4e-8b3d-4f5a-9c7e-1d2b3c4d5e6f';

  const restaurantRow = {
    userId: RESTAURANT_ID,
    restaurantName: 'Cantina Bella Massa',
    cuisineType: 'Italiana',
    description: 'Massas artesanais e ambiente familiar',
    address: 'Rua das Flores, 100',
    phone: '(73) 99999-0000',
    zipCode: null,
    logoUrl: null,
    averageRating: 4.5,
    jobs: [
      {
        id: 'job-1',
        title: 'Garçom',
        contractType: 'CLT',
        salary: null,
        shifts: ['NOITE'],
        urgent: false,
        createdAt: new Date('2026-11-18T10:00:00Z'),
      },
    ],
    _count: { avaliacoes: 2 },
  };

  beforeAll(async () => {
    prisma = { restaurant: { findFirst: jest.fn() } };

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
        RestaurantsModule,
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

  it.each([Role.PROFISSIONAL, Role.RESTAURANTE])(
    'retorna 200 com dados e vagas abertas para token de %s, sem cnpj',
    async (role) => {
      prisma.restaurant.findFirst.mockResolvedValue(restaurantRow);

      const response = await request(app.getHttpServer())
        .get(`/api/restaurants/${RESTAURANT_ID}`)
        .set(authHeader('qualquer-usuario', role))
        .expect(200);

      expect(response.body).toEqual({
        id: RESTAURANT_ID,
        restaurantName: 'Cantina Bella Massa',
        cuisineType: 'Italiana',
        description: 'Massas artesanais e ambiente familiar',
        address: 'Rua das Flores, 100',
        phone: '(73) 99999-0000',
        zipCode: null,
        logoUrl: null,
        averageRating: 4.5,
        reviewsCount: 2,
        openJobs: [
          {
            id: 'job-1',
            title: 'Garçom',
            contractType: 'CLT',
            salary: null,
            shifts: ['NOITE'],
            urgent: false,
            createdAt: '2026-11-18T10:00:00.000Z',
          },
        ],
      });
      expect(response.body).not.toHaveProperty('cnpj');
      expect(response.body).not.toHaveProperty('email');
    },
  );

  it('retorna 400 quando o id não é UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/restaurants/abc')
      .set(authHeader('prof-1', Role.PROFISSIONAL))
      .expect(400);

    expect(prisma.restaurant.findFirst).not.toHaveBeenCalled();
  });

  it('retorna 401 sem token', async () => {
    await request(app.getHttpServer())
      .get(`/api/restaurants/${RESTAURANT_ID}`)
      .expect(401);

    expect(prisma.restaurant.findFirst).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o restaurante foi excluído ou não existe', async () => {
    prisma.restaurant.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(`/api/restaurants/${RESTAURANT_ID}`)
      .set(authHeader('prof-1', Role.PROFISSIONAL))
      .expect(404);

    expect(response.body).toMatchObject({
      message: 'Restaurante não encontrado',
    });
  });
});
