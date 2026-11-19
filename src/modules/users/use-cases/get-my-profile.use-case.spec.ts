import { NotFoundException } from '@nestjs/common';
import { Mobility, WorkModel } from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import { EXPERIENCES_INCLUDE } from '../professional-profile.mapper';
import { GetMyProfileUseCase } from './get-my-profile.use-case';

const createMockPrisma = () => ({
  professional: {
    findFirst: jest.fn(),
  },
});

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

    const result = await useCase.execute('professional-1');

    expect(prisma.professional.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'professional-1',
        deletedAt: null,
        user: { deletedAt: null },
      },
      include: EXPERIENCES_INCLUDE,
    });
    expect(result).toEqual({
      id: 'professional-1',
      fullName: 'Julian Rossi',
      mainRole: 'Chef Executivo',
      profilePhoto: null,
      experienceSummary: null,
      specialties: ['Cozinha francesa', 'Confeitaria'],
      neighborhood: 'Pinheiros',
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

    const result = await useCase.execute('professional-1');

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

    const result = await useCase.execute('professional-1');

    expect(result.availability).toEqual({ workModels: [], mobility: 'LOCAL' });
  });

  it('não expõe campos fora do contrato', async () => {
    prisma.professional.findFirst.mockResolvedValue(professionalRow());

    const result = await useCase.execute('professional-1');

    expect(result).not.toHaveProperty('zipCode');
    expect(result).not.toHaveProperty('averageRating');
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('workModels');
  });

  it('lança 404 quando não há cadastro de profissional ativo', async () => {
    prisma.professional.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('restaurant-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
