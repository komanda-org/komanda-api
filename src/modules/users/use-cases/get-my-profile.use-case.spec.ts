import { NotFoundException } from '@nestjs/common';
import { Mobility, PlanType, Role, WorkModel } from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import { EXPERIENCES_INCLUDE } from '../professional-profile.mapper';
import { GetMyProfileUseCase } from './get-my-profile.use-case';

const createMockPrisma = () => ({
  professional: {
    findFirst: jest.fn(),
  },
  restaurant: {
    findFirst: jest.fn(),
  },
});

const PROF = { id: 'professional-1', role: Role.PROFISSIONAL };

type MockPrisma = ReturnType<typeof createMockPrisma>;

const professionalRow = (overrides: Record<string, unknown> = {}) => ({
  userId: 'professional-1',
  fullName: 'Julian Rossi',
  mainRole: 'Chef Executivo',
  profilePhoto: null,
  experienceSummary: null,
  neighborhood: 'Pinheiros',
  zipCode: '05422-000',
  interestedRoles: ['Confeiteiro'],
  averageRating: 4.5,
  specialties: [],
  city: null,
  state: null,
  workModels: [],
  mobility: null,
  experiences: [],
  ...overrides,
});

describe('GetMyProfileUseCase', () => {
  let useCase: GetMyProfileUseCase;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new GetMyProfileUseCase(prisma as unknown as PrismaService);
  });

  it('busca pelo id do token e devolve o perfil completo no formato do front', async () => {
    prisma.professional.findFirst.mockResolvedValue(
      professionalRow({
        specialties: ['Cozinha francesa', 'Confeitaria'],
        city: 'São Paulo',
        state: 'SP',
        workModels: [WorkModel.CLT, WorkModel.TEMPORARIO],
        mobility: Mobility.NACIONAL,
        experiences: [
          {
            id: 'exp-2',
            company: 'Restaurante Origem',
            role: 'Chef Executivo',
            startDate: new Date('2019-01-01T00:00:00Z'),
            endDate: null,
            description: null,
          },
          {
            id: 'exp-1',
            company: 'Bistrô Antigo',
            role: 'Sous Chef',
            startDate: new Date('2015-03-01T00:00:00Z'),
            endDate: new Date('2018-12-31T00:00:00Z'),
            description: 'Cozinha de bistrô',
          },
        ],
      }),
    );

    const result = await useCase.execute(PROF);

    expect(prisma.professional.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'professional-1',
        deletedAt: null,
        user: { deletedAt: null },
      },
      include: EXPERIENCES_INCLUDE,
    });
    expect(result).toEqual({
      role: 'PROFISSIONAL',
      id: 'professional-1',
      fullName: 'Julian Rossi',
      mainRole: 'Chef Executivo',
      profilePhoto: null,
      experienceSummary: null,
      specialties: ['Cozinha francesa', 'Confeitaria'],
      neighborhood: 'Pinheiros',
      zipCode: '05422-000',
      city: 'São Paulo',
      state: 'SP',
      experiences: [
        {
          id: 'exp-2',
          company: 'Restaurante Origem',
          role: 'Chef Executivo',
          startDate: '2019-01-01',
          endDate: null,
          description: null,
        },
        {
          id: 'exp-1',
          company: 'Bistrô Antigo',
          role: 'Sous Chef',
          startDate: '2015-03-01',
          endDate: '2018-12-31',
          description: 'Cozinha de bistrô',
        },
      ],
      availability: { workModels: ['CLT', 'TEMPORARIO'], mobility: 'NACIONAL' },
    });
  });

  it('perfil sem dados extras devolve [] e null', async () => {
    prisma.professional.findFirst.mockResolvedValue(professionalRow());

    const result = await useCase.execute(PROF);

    expect(result.specialties).toEqual([]);
    expect(result.experiences).toEqual([]);
    expect(result.city).toBeNull();
    expect(result.state).toBeNull();
    expect(result.availability).toBeNull();
  });

  it('só mobilidade informada ainda gera availability', async () => {
    prisma.professional.findFirst.mockResolvedValue(
      professionalRow({ mobility: Mobility.LOCAL }),
    );

    const result = await useCase.execute(PROF);

    expect(result.availability).toEqual({ workModels: [], mobility: 'LOCAL' });
  });

  it('não expõe campos fora do contrato', async () => {
    prisma.professional.findFirst.mockResolvedValue(professionalRow());

    const result = await useCase.execute(PROF);

    expect(result).not.toHaveProperty('averageRating');
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('workModels');
  });

  it('lança 404 quando não há cadastro de profissional ativo', async () => {
    prisma.professional.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({ id: 'prof-x', role: Role.PROFISSIONAL }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.restaurant.findFirst).not.toHaveBeenCalled();
  });

  describe('restaurante', () => {
    const REST = { id: 'restaurant-1', role: Role.RESTAURANTE };
    const restaurantRow = {
      userId: 'restaurant-1',
      restaurantName: 'Cantina Bella Massa',
      cnpj: '12.345.678/0001-95',
      cuisineType: 'Italiana',
      description: 'Massas artesanais e ambiente familiar',
      address: 'Rua das Flores, 100',
      phone: '(73) 99999-0000',
      zipCode: null,
      logoUrl: 'https://cdn.komanda.dev/logo.png',
      averageRating: null,
      plan: PlanType.FREE,
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { email: 'cantina@komanda.dev' },
    };

    it('busca pelo id do token, sem consultar profissional', async () => {
      prisma.restaurant.findFirst.mockResolvedValue(restaurantRow);

      const result = await useCase.execute(REST);

      expect(prisma.restaurant.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'restaurant-1',
          deletedAt: null,
          user: { deletedAt: null },
        },
        include: { user: { select: { email: true } } },
      });
      expect(prisma.professional.findFirst).not.toHaveBeenCalled();
      expect(result).toEqual({
        role: 'RESTAURANTE',
        id: 'restaurant-1',
        email: 'cantina@komanda.dev',
        restaurantName: 'Cantina Bella Massa',
        cnpj: '12.345.678/0001-95',
        cuisineType: 'Italiana',
        description: 'Massas artesanais e ambiente familiar',
        address: 'Rua das Flores, 100',
        phone: '(73) 99999-0000',
        zipCode: null,
        logoUrl: 'https://cdn.komanda.dev/logo.png',
        averageRating: null,
        plan: 'FREE',
      });
    });

    it('não expõe campos internos', async () => {
      prisma.restaurant.findFirst.mockResolvedValue(restaurantRow);

      const result = await useCase.execute(REST);

      for (const field of ['userId', 'active', 'deletedAt', 'user']) {
        expect(result).not.toHaveProperty(field);
      }
    });

    it('lança 404 quando o restaurante foi excluído ou não existe', async () => {
      prisma.restaurant.findFirst.mockResolvedValue(null);

      await expect(useCase.execute(REST)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
