import { NotFoundException } from '@nestjs/common';
import { Mobility, Prisma, Role, WorkModel } from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import { GetProfessionalPublicProfileUseCase } from './get-professional-public-profile.use-case';

const createMockPrisma = () => ({
  professional: { findFirst: jest.fn() },
});

const professionalRow = () => ({
  userId: 'professional-1',
  fullName: 'Marina Souza',
  profilePhoto: null,
  mainRole: 'Garçonete',
  interestedRoles: ['Bartender'],
  specialties: ['Atendimento', 'Vinhos'],
  experienceSummary: '5 anos em restaurantes',
  city: 'Porto Seguro',
  state: 'BA',
  neighborhood: 'Centro',
  workModels: [WorkModel.CLT, WorkModel.FREELANCER],
  mobility: Mobility.REGIONAL,
  averageRating: 4.6,
  createdAt: new Date('2026-01-10T12:00:00Z'),
  experiences: [
    {
      id: 'exp-2',
      company: 'Maré Alta',
      role: 'Garçonete',
      startDate: new Date('2024-03-01'),
      endDate: null,
      description: null,
    },
    {
      id: 'exp-1',
      company: 'Bistrô Sol',
      role: 'Cumim',
      startDate: new Date('2021-02-01'),
      endDate: new Date('2024-01-31'),
      description: 'Apoio ao salão',
    },
  ],
  _count: { avaliacoes: 12 },
});

type FindFirstArgs = {
  where: Prisma.ProfessionalWhereInput;
  select: {
    experiences: { orderBy: unknown };
    _count: { select: { avaliacoes: unknown } };
  };
};

describe('GetProfessionalPublicProfileUseCase', () => {
  let useCase: GetProfessionalPublicProfileUseCase;
  let prisma: ReturnType<typeof createMockPrisma>;

  const findFirstArgs = (): FindFirstArgs =>
    (prisma.professional.findFirst.mock.calls as FindFirstArgs[][])[0][0];

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new GetProfessionalPublicProfileUseCase(
      prisma as unknown as PrismaService,
    );
  });

  it('retorna o perfil público com experiências e contagem de avaliações', async () => {
    const row = professionalRow();
    prisma.professional.findFirst.mockResolvedValue(row);

    const result = await useCase.execute('professional-1');

    expect(result).toEqual({
      id: 'professional-1',
      fullName: 'Marina Souza',
      profilePhoto: null,
      mainRole: 'Garçonete',
      interestedRoles: ['Bartender'],
      specialties: ['Atendimento', 'Vinhos'],
      experienceSummary: '5 anos em restaurantes',
      city: 'Porto Seguro',
      state: 'BA',
      neighborhood: 'Centro',
      workModels: [WorkModel.CLT, WorkModel.FREELANCER],
      mobility: Mobility.REGIONAL,
      averageRating: 4.6,
      reviewsCount: 12,
      memberSince: row.createdAt,
      experiences: row.experiences,
    });
  });

  it('filtra perfil e conta excluídos ou inativos, e conta só avaliações de restaurantes', async () => {
    prisma.professional.findFirst.mockResolvedValue(professionalRow());

    await useCase.execute('professional-1');

    const args = findFirstArgs();
    expect(args.where).toEqual({
      userId: 'professional-1',
      active: true,
      deletedAt: null,
      user: { active: true, deletedAt: null },
    });
    expect(args.select.experiences.orderBy).toEqual({ startDate: 'desc' });
    expect(args.select._count.select.avaliacoes).toEqual({
      where: { avaliadorRole: Role.RESTAURANTE },
    });
  });

  it('nunca seleciona e-mail, CEP nem dados de login', async () => {
    prisma.professional.findFirst.mockResolvedValue(professionalRow());

    const result = await useCase.execute('professional-1');

    const { select } = findFirstArgs();
    for (const field of ['zipCode', 'user', 'email', 'passwordHash']) {
      expect(select).not.toHaveProperty(field);
      expect(result).not.toHaveProperty(field);
    }
  });

  it('lança 404 quando não encontra (inexistente, excluído ou inativo)', async () => {
    prisma.professional.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('professional-1')).rejects.toThrow(
      new NotFoundException('Profissional não encontrado'),
    );
  });
});
