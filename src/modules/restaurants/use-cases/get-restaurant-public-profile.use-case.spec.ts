import { NotFoundException } from '@nestjs/common';
import {
  ContractType,
  JobStatus,
  Prisma,
  Role,
  JobShift,
} from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import {
  GetRestaurantPublicProfileUseCase,
  OPEN_JOBS_LIMIT,
} from './get-restaurant-public-profile.use-case';

const createMockPrisma = () => ({
  restaurant: { findFirst: jest.fn() },
});

const restaurantRow = (overrides: Record<string, unknown> = {}) => ({
  userId: 'restaurant-1',
  restaurantName: 'Cantina Bella Massa',
  cuisineType: 'Italiana',
  description: 'Massas artesanais e ambiente familiar',
  address: 'Rua das Flores, 100',
  phone: '(73) 99999-0000',
  zipCode: '45820-020',
  logoUrl: null,
  averageRating: 4.5,
  jobs: [
    {
      id: 'job-1',
      title: 'Garçom',
      contractType: ContractType.CLT,
      salary: new Prisma.Decimal('2200.50'),
      shifts: [JobShift.NOITE],
      urgent: true,
      createdAt: new Date('2026-11-18T10:00:00Z'),
    },
    {
      id: 'job-2',
      title: 'Cozinheiro',
      contractType: ContractType.FREELANCER,
      salary: null,
      shifts: [],
      urgent: false,
      createdAt: new Date('2026-11-17T10:00:00Z'),
    },
  ],
  _count: { avaliacoes: 3 },
  ...overrides,
});

describe('GetRestaurantPublicProfileUseCase', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let useCase: GetRestaurantPublicProfileUseCase;

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new GetRestaurantPublicProfileUseCase(
      prisma as unknown as PrismaService,
    );
  });

  it('filtra restaurante ativo, vagas abertas e avaliações de profissionais numa consulta só', async () => {
    prisma.restaurant.findFirst.mockResolvedValue(restaurantRow());

    await useCase.execute('restaurant-1');

    expect(prisma.restaurant.findFirst).toHaveBeenCalledTimes(1);
    const [[args]] = prisma.restaurant.findFirst.mock.calls as [
      [
        {
          where: unknown;
          select: {
            cnpj?: unknown;
            jobs: unknown;
            _count: unknown;
          };
        },
      ],
    ];
    expect(args.where).toEqual({
      userId: 'restaurant-1',
      active: true,
      deletedAt: null,
      user: { deletedAt: null },
    });
    expect(args.select.jobs).toMatchObject({
      where: { status: JobStatus.ABERTA, active: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: OPEN_JOBS_LIMIT,
    });
    expect(args.select._count).toEqual({
      select: { avaliacoes: { where: { avaliadorRole: Role.PROFISSIONAL } } },
    });
    expect(args.select.cnpj).toBeUndefined();
  });

  it('devolve o perfil público com vagas e salário numérico', async () => {
    prisma.restaurant.findFirst.mockResolvedValue(restaurantRow());

    const result = await useCase.execute('restaurant-1');

    expect(result).toEqual({
      id: 'restaurant-1',
      restaurantName: 'Cantina Bella Massa',
      cuisineType: 'Italiana',
      description: 'Massas artesanais e ambiente familiar',
      address: 'Rua das Flores, 100',
      phone: '(73) 99999-0000',
      zipCode: '45820-020',
      logoUrl: null,
      averageRating: 4.5,
      reviewsCount: 3,
      openJobs: [
        {
          id: 'job-1',
          title: 'Garçom',
          contractType: ContractType.CLT,
          salary: 2200.5,
          shifts: [JobShift.NOITE],
          urgent: true,
          createdAt: new Date('2026-11-18T10:00:00Z'),
        },
        {
          id: 'job-2',
          title: 'Cozinheiro',
          contractType: ContractType.FREELANCER,
          salary: null,
          shifts: [],
          urgent: false,
          createdAt: new Date('2026-11-17T10:00:00Z'),
        },
      ],
    });
  });

  it('não expõe cnpj, e-mail nem plano', async () => {
    prisma.restaurant.findFirst.mockResolvedValue(
      restaurantRow({ cnpj: '12.345.678/0001-95', plan: 'FREE' }),
    );

    const result = await useCase.execute('restaurant-1');

    expect(result).not.toHaveProperty('cnpj');
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('plan');
  });

  it('restaurante sem vagas abertas devolve lista vazia', async () => {
    prisma.restaurant.findFirst.mockResolvedValue(
      restaurantRow({ jobs: [], _count: { avaliacoes: 0 } }),
    );

    const result = await useCase.execute('restaurant-1');

    expect(result.openJobs).toEqual([]);
    expect(result.reviewsCount).toBe(0);
  });

  it('404 quando não existe, está inativo ou foi excluído', async () => {
    prisma.restaurant.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('restaurant-x')).rejects.toThrow(
      new NotFoundException('Restaurante não encontrado'),
    );
  });
});
