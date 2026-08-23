import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListAvaliacoesRecebidasUseCase } from './list-avaliacoes-recebidas.use-case';

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

describe('ListAvaliacoesRecebidasUseCase', () => {
  let useCase: ListAvaliacoesRecebidasUseCase;
  let prisma: MockPrisma;

  const PROFISSIONAL_ID = 'professional-1';
  const RESTAURANTE_ID = 'restaurant-1';
  const createdAt = new Date('2026-07-10T12:00:00Z');

  const avaliacaoRow = {
    id: 'avaliacao-1',
    rating: 5,
    comment: 'Excelente profissional',
    jobId: 'job-1',
    professionalId: PROFISSIONAL_ID,
    restaurantId: RESTAURANTE_ID,
    createdAt,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new ListAvaliacoesRecebidasUseCase(
      prisma as unknown as PrismaService,
    );
  });

  it('lança NotFoundException quando o usuário não existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({ usuarioId: PROFISSIONAL_ID }),
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
      useCase.execute({ usuarioId: PROFISSIONAL_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.avaliacao.findMany).not.toHaveBeenCalled();
  });

  it('lista as avaliações recebidas por um profissional (feitas por restaurantes)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: Role.PROFISSIONAL,
      active: true,
      deletedAt: null,
    });
    prisma.avaliacao.findMany.mockResolvedValue([avaliacaoRow]);
    prisma.avaliacao.count.mockResolvedValue(1);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: 5 } });

    const result = await useCase.execute({ usuarioId: PROFISSIONAL_ID });

    const where = {
      professionalId: PROFISSIONAL_ID,
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
          id: 'avaliacao-1',
          rating: 5,
          comment: 'Excelente profissional',
          jobId: 'job-1',
          avaliadorId: RESTAURANTE_ID,
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
    prisma.avaliacao.findMany.mockResolvedValue([avaliacaoRow]);
    prisma.avaliacao.count.mockResolvedValue(1);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: 5 } });

    const result = await useCase.execute({ usuarioId: RESTAURANTE_ID });

    const where = {
      restaurantId: RESTAURANTE_ID,
      avaliadorRole: Role.PROFISSIONAL,
    };
    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(result.data[0].avaliadorId).toBe(PROFISSIONAL_ID);
  });

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
      usuarioId: PROFISSIONAL_ID,
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

    const result = await useCase.execute({ usuarioId: PROFISSIONAL_ID });

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

    const result = await useCase.execute({ usuarioId: PROFISSIONAL_ID });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.averageRating).toBeNull();
  });
});
