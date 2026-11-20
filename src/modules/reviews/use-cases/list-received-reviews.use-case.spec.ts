import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListReceivedReviewsUseCase } from './list-received-reviews.use-case';

const createMockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
  },
  avaliacao: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('ListReceivedReviewsUseCase', () => {
  let useCase: ListReceivedReviewsUseCase;
  let prisma: MockPrisma;

  const PROFESSIONAL_ID = 'professional-1';
  const RESTAURANT_ID = 'restaurant-1';
  const createdAt = new Date('2026-07-10T12:00:00Z');

  const available = {
    active: true,
    deletedAt: null,
    user: { active: true, deletedAt: null },
  };

  const reviewRow = {
    id: 'review-1',
    rating: 5,
    comment: 'Excelente profissional',
    jobId: 'job-1',
    professionalId: PROFESSIONAL_ID,
    restaurantId: RESTAURANT_ID,
    createdAt,
    professional: {
      fullName: 'Marina Souza',
      profilePhoto: 'https://img/marina.png',
      ...available,
    },
    restaurant: {
      restaurantName: 'Maré Alta',
      logoUrl: 'https://img/mare.png',
      ...available,
    },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new ListReceivedReviewsUseCase(
      prisma as unknown as PrismaService,
    );
  });

  it('lança NotFoundException quando o usuário não existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: PROFESSIONAL_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.avaliacao.findMany).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o usuário está inativo ou soft-deletado', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: Role.PROFISSIONAL,
      active: false,
      deletedAt: null,
    });

    await expect(
      useCase.execute({ userId: PROFESSIONAL_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.avaliacao.findMany).not.toHaveBeenCalled();
  });

  it('lista as avaliações recebidas por um profissional (feitas por restaurantes)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: Role.PROFISSIONAL,
      active: true,
      deletedAt: null,
    });
    prisma.avaliacao.findMany.mockResolvedValue([reviewRow]);
    prisma.avaliacao.count.mockResolvedValue(1);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: 5 } });

    const result = await useCase.execute({ userId: PROFESSIONAL_ID });

    const where = {
      professionalId: PROFESSIONAL_ID,
      avaliadorRole: Role.RESTAURANTE,
    };
    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, orderBy: { createdAt: 'desc' } }),
    );
    expect(prisma.avaliacao.count).toHaveBeenCalledWith({ where });
    expect(prisma.avaliacao.aggregate).toHaveBeenCalledWith({
      where,
      _avg: { rating: true },
    });

    expect(result).toEqual({
      data: [
        {
          id: 'review-1',
          rating: 5,
          comment: 'Excelente profissional',
          jobId: 'job-1',
          reviewerId: RESTAURANT_ID,
          reviewer: {
            id: RESTAURANT_ID,
            name: 'Maré Alta',
            photo: 'https://img/mare.png',
            role: Role.RESTAURANTE,
          },
          createdAt,
        },
      ],
      total: 1,
      skip: 0,
      take: 20,
      averageRating: 5,
    });
  });

  it('lista as avaliações recebidas por um restaurante (feitas por profissionais)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: Role.RESTAURANTE,
      active: true,
      deletedAt: null,
    });
    prisma.avaliacao.findMany.mockResolvedValue([reviewRow]);
    prisma.avaliacao.count.mockResolvedValue(1);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: 5 } });

    const result = await useCase.execute({ userId: RESTAURANT_ID });

    const where = {
      restaurantId: RESTAURANT_ID,
      avaliadorRole: Role.PROFISSIONAL,
    };
    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(result.data[0].reviewerId).toBe(PROFESSIONAL_ID);
    expect(result.data[0].reviewer).toEqual({
      id: PROFESSIONAL_ID,
      name: 'Marina Souza',
      photo: 'https://img/marina.png',
      role: Role.PROFISSIONAL,
    });
  });

  it.each([
    [
      'conta do usuário excluída',
      { user: { active: true, deletedAt: new Date() } },
    ],
    ['conta do usuário inativa', { user: { active: false, deletedAt: null } }],
    ['perfil excluído', { deletedAt: new Date() }],
  ])(
    'mostra "Usuário removido" sem foto quando o autor tem %s',
    async (_caso, override) => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.PROFISSIONAL,
        active: true,
        deletedAt: null,
      });
      prisma.avaliacao.findMany.mockResolvedValue([
        { ...reviewRow, restaurant: { ...reviewRow.restaurant, ...override } },
      ]);
      prisma.avaliacao.count.mockResolvedValue(1);
      prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: 5 } });

      const result = await useCase.execute({ userId: PROFESSIONAL_ID });

      expect(result.data[0].reviewer).toEqual({
        id: RESTAURANT_ID,
        name: 'Usuário removido',
        photo: null,
        role: Role.RESTAURANTE,
      });
    },
  );

  it('aplica skip/take informados na paginação', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: Role.PROFISSIONAL,
      active: true,
      deletedAt: null,
    });
    prisma.avaliacao.findMany.mockResolvedValue([]);
    prisma.avaliacao.count.mockResolvedValue(0);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: null } });

    const result = await useCase.execute({
      userId: PROFESSIONAL_ID,
      skip: 10,
      take: 5,
    });

    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
    expect(result.skip).toBe(10);
    expect(result.take).toBe(5);
  });

  it('usa skip/take padrão quando não informados', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: Role.PROFISSIONAL,
      active: true,
      deletedAt: null,
    });
    prisma.avaliacao.findMany.mockResolvedValue([]);
    prisma.avaliacao.count.mockResolvedValue(0);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: null } });

    const result = await useCase.execute({ userId: PROFESSIONAL_ID });

    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });

  it('retorna média nula quando o usuário não tem avaliações', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: Role.PROFISSIONAL,
      active: true,
      deletedAt: null,
    });
    prisma.avaliacao.findMany.mockResolvedValue([]);
    prisma.avaliacao.count.mockResolvedValue(0);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: null } });

    const result = await useCase.execute({ userId: PROFESSIONAL_ID });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.averageRating).toBeNull();
  });
});
